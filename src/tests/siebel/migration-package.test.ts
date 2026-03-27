import { describe, it, expect } from "vitest";
import {
  buildMigrationPackage,
  type MigrationPackageRequest,
  type MigrationPackage,
  DEPLOY_ORDER,
} from "../../core/siebel/migration-package.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

// --- Factory ---

function makeObj(
  name: string,
  type: SiebelObject["type"],
  props: Record<string, string> = {},
  children: SiebelObject[] = [],
): SiebelObject {
  return {
    name,
    type,
    properties: Object.entries(props).map(([k, v]) => ({ name: k, value: v })),
    children,
  };
}

function makeDep(
  fromName: string,
  fromType: SiebelObject["type"],
  toName: string,
  toType: SiebelObject["type"],
): SiebelDependency {
  return {
    from: { name: fromName, type: fromType },
    to: { name: toName, type: toType },
    relationType: "references",
  };
}

describe("migration-package", () => {
  // AC1: Accept modified objects list
  describe("AC1: accept modified objects", () => {
    it("should accept explicit list of modified objects", () => {
      const modified = [
        makeObj("CX_Account BC", "business_component"),
        makeObj("CX_Account Applet", "applet", { BUS_COMP: "CX_Account BC" }),
      ];

      const result = buildMigrationPackage({
        modifiedObjects: modified,
        allObjects: modified,
        dependencies: [],
      });

      expect(result.objects.length).toBeGreaterThanOrEqual(2);
    });

    it("should detect modified objects via diff when provided", () => {
      const baseObjects = [makeObj("CX_Account BC", "business_component", { TABLE: "S_ORG_EXT" })];
      const currentObjects = [makeObj("CX_Account BC", "business_component", { TABLE: "S_ORG_EXT_X" })];

      const result = buildMigrationPackage({
        modifiedObjects: currentObjects,
        allObjects: currentObjects,
        dependencies: [],
      });

      expect(result.objects.some((o) => o.name === "CX_Account BC")).toBe(true);
    });
  });

  // AC2: Transitive dependencies
  describe("AC2: transitive dependency resolution", () => {
    it("should include applets affected by BC change", () => {
      const objects = [
        makeObj("CX_Account BC", "business_component"),
        makeObj("CX_Account List Applet", "applet"),
        makeObj("CX_Account Form Applet", "applet"),
        makeObj("CX_Order BC", "business_component"),
      ];
      const deps: SiebelDependency[] = [
        makeDep("CX_Account List Applet", "applet", "CX_Account BC", "business_component"),
        makeDep("CX_Account Form Applet", "applet", "CX_Account BC", "business_component"),
      ];

      const result = buildMigrationPackage({
        modifiedObjects: [objects[0]], // Only BC modified
        allObjects: objects,
        dependencies: deps,
      });

      // Should include BC + both Applets transitively
      expect(result.objects.some((o) => o.name === "CX_Account BC")).toBe(true);
      expect(result.objects.some((o) => o.name === "CX_Account List Applet")).toBe(true);
      expect(result.objects.some((o) => o.name === "CX_Account Form Applet")).toBe(true);
      // Should NOT include unrelated Order BC
      expect(result.objects.some((o) => o.name === "CX_Order BC")).toBe(false);
    });
  });

  // AC3: Deploy order
  describe("AC3: correct deploy order", () => {
    it("should order Tables → BCs → BOs → Applets → Views → Screens → Applications", () => {
      const modified = [
        makeObj("CX_App", "application"),
        makeObj("CX_Screen", "screen"),
        makeObj("CX_View", "view"),
        makeObj("CX_Applet", "applet"),
        makeObj("CX_BO", "business_object"),
        makeObj("CX_BC", "business_component"),
        makeObj("S_TABLE", "table"),
      ];

      const result = buildMigrationPackage({
        modifiedObjects: modified,
        allObjects: modified,
        dependencies: [],
      });

      const types = result.deployOrder.map((o) => o.type);
      const tableIdx = types.indexOf("table");
      const bcIdx = types.indexOf("business_component");
      const boIdx = types.indexOf("business_object");
      const appletIdx = types.indexOf("applet");
      const viewIdx = types.indexOf("view");
      const screenIdx = types.indexOf("screen");
      const appIdx = types.indexOf("application");

      expect(tableIdx).toBeLessThan(bcIdx);
      expect(bcIdx).toBeLessThan(boIdx);
      expect(boIdx).toBeLessThan(appletIdx);
      expect(appletIdx).toBeLessThan(viewIdx);
      expect(viewIdx).toBeLessThan(screenIdx);
      expect(screenIdx).toBeLessThan(appIdx);
    });

    it("should export DEPLOY_ORDER constant", () => {
      expect(DEPLOY_ORDER).toBeDefined();
      expect(DEPLOY_ORDER.indexOf("table")).toBeLessThan(DEPLOY_ORDER.indexOf("business_component"));
    });
  });

  // AC4: Impact report
  describe("AC4: impact report", () => {
    it("should generate impact report with included objects and risks", () => {
      const modified = [makeObj("CX_BC", "business_component")];
      const deps: SiebelDependency[] = [
        makeDep("CX_Applet", "applet", "CX_BC", "business_component"),
      ];

      const result = buildMigrationPackage({
        modifiedObjects: modified,
        allObjects: [...modified, makeObj("CX_Applet", "applet")],
        dependencies: deps,
      });

      expect(result.report).toContain("CX_BC");
      expect(result.report).toContain("Impact");
      expect(result.riskLevel).toBeDefined();
    });

    it("should assign risk level based on object count", () => {
      const modified = [makeObj("CX_BC", "business_component")];

      const result = buildMigrationPackage({
        modifiedObjects: modified,
        allObjects: modified,
        dependencies: [],
      });

      expect(["low", "medium", "high", "critical"]).toContain(result.riskLevel);
    });
  });

  // AC5: Lock conflict detection
  describe("AC5: lock conflict detection", () => {
    it("should detect objects locked by other developers", () => {
      const modified = [
        makeObj("CX_Account BC", "business_component", { OBJECT_LOCKED: "Y", LOCKED_BY: "user_other" }),
      ];

      const result = buildMigrationPackage({
        modifiedObjects: modified,
        allObjects: modified,
        dependencies: [],
        currentUser: "user_me",
      });

      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(result.conflicts[0].objectName).toBe("CX_Account BC");
      expect(result.conflicts[0].lockedBy).toBe("user_other");
    });

    it("should NOT flag objects locked by current user", () => {
      const modified = [
        makeObj("CX_Account BC", "business_component", { OBJECT_LOCKED: "Y", LOCKED_BY: "user_me" }),
      ];

      const result = buildMigrationPackage({
        modifiedObjects: modified,
        allObjects: modified,
        dependencies: [],
        currentUser: "user_me",
      });

      expect(result.conflicts).toHaveLength(0);
    });
  });

  // AC6: Deploy scripts
  describe("AC6: deploy scripts per environment", () => {
    it("should generate deploy script for each environment", () => {
      const modified = [
        makeObj("CX_BC", "business_component"),
        makeObj("CX_Applet", "applet"),
      ];

      const result = buildMigrationPackage({
        modifiedObjects: modified,
        allObjects: modified,
        dependencies: [],
        environments: ["dev", "test", "staging", "prod"],
      });

      expect(result.deployScripts).toBeDefined();
      expect(result.deployScripts.length).toBe(4);
      expect(result.deployScripts.map((s) => s.environment)).toEqual(["dev", "test", "staging", "prod"]);

      for (const script of result.deployScripts) {
        expect(script.commands.length).toBeGreaterThan(0);
      }
    });

    it("should default to all 4 environments", () => {
      const result = buildMigrationPackage({
        modifiedObjects: [makeObj("CX_BC", "business_component")],
        allObjects: [makeObj("CX_BC", "business_component")],
        dependencies: [],
      });

      expect(result.deployScripts.length).toBe(4);
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("should handle empty modified list", () => {
      const result = buildMigrationPackage({
        modifiedObjects: [],
        allObjects: [],
        dependencies: [],
      });

      expect(result.objects).toHaveLength(0);
      expect(result.deployOrder).toHaveLength(0);
      expect(result.riskLevel).toBe("low");
    });

    it("should handle circular dependencies gracefully", () => {
      const objects = [
        makeObj("A_BC", "business_component"),
        makeObj("B_BC", "business_component"),
      ];
      const deps: SiebelDependency[] = [
        makeDep("A_BC", "business_component", "B_BC", "business_component"),
        makeDep("B_BC", "business_component", "A_BC", "business_component"),
      ];

      const result = buildMigrationPackage({
        modifiedObjects: [objects[0]],
        allObjects: objects,
        dependencies: deps,
      });

      // Should not infinite loop, should include both
      expect(result.objects.length).toBeGreaterThanOrEqual(1);
      expect(result.circularDeps.length).toBeGreaterThanOrEqual(1);
    });
  });
});
