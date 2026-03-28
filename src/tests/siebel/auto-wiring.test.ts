import { describe, it, expect } from "vitest";
import {
  autoWireDependencies,
} from "../../core/siebel/auto-wiring.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

// --- Factory helpers ---

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

describe("auto-wiring", () => {
  // AC1: Applet → BC check
  describe("AC1: Applet → BC dependency", () => {
    it("should detect missing BC when applet references non-existent BC", () => {
      const newObjects = [makeObj("AC Order List Applet", "applet", { BUS_COMP: "AC Order BC" })];
      const repository: SiebelObject[] = [];

      const result = autoWireDependencies({ newObjects, repository });

      expect(result.missingDependencies).toHaveLength(1);
      expect(result.missingDependencies[0]).toMatchObject({
        from: { name: "AC Order List Applet", type: "applet" },
        to: { name: "AC Order BC", type: "business_component" },
        relationType: "references",
        suggestion: "create",
      });
    });

    it("should NOT flag missing BC when it exists in repository", () => {
      const newObjects = [makeObj("AC Order List Applet", "applet", { BUS_COMP: "AC Order BC" })];
      const repository = [makeObj("AC Order BC", "business_component")];

      const result = autoWireDependencies({ newObjects, repository });

      const bcMissing = result.missingDependencies.filter(
        (d) => d.to.name === "AC Order BC",
      );
      expect(bcMissing).toHaveLength(0);
    });

    it("should NOT flag missing BC when it is in newObjects itself", () => {
      const newObjects = [
        makeObj("AC Order List Applet", "applet", { BUS_COMP: "AC Order BC" }),
        makeObj("AC Order BC", "business_component"),
      ];

      const result = autoWireDependencies({ newObjects, repository: [] });

      const bcMissing = result.missingDependencies.filter(
        (d) => d.to.name === "AC Order BC",
      );
      expect(bcMissing).toHaveLength(0);
    });
  });

  // AC2: View → Applet check
  describe("AC2: View → Applet dependency", () => {
    it("should detect missing applets referenced by view", () => {
      const newObjects = [
        makeObj("AC Order View", "view", {}, [
          makeObj("AC Order List Applet", "applet"),
          makeObj("AC Order Form Applet", "applet"),
        ]),
      ];
      const repository: SiebelObject[] = [];

      const result = autoWireDependencies({ newObjects, repository });

      const appletMissing = result.missingDependencies.filter(
        (d) => d.from.type === "view" && d.to.type === "applet",
      );
      expect(appletMissing.length).toBeGreaterThanOrEqual(2);
    });

    it("should wire view to existing applets in repository", () => {
      const newObjects = [
        makeObj("AC Order View", "view", {}, [
          makeObj("CX Order List Applet", "applet"),
        ]),
      ];
      const repository = [makeObj("CX Order List Applet", "applet")];

      const result = autoWireDependencies({ newObjects, repository });

      // Applet exists → should create a wired edge, NOT a missing dep
      const appletMissing = result.missingDependencies.filter(
        (d) => d.to.name === "CX Order List Applet",
      );
      expect(appletMissing).toHaveLength(0);
      expect(result.wiredEdges.some((e) => e.to.name === "CX Order List Applet")).toBe(true);
    });
  });

  // AC3: BC → Table suggestion
  describe("AC3: BC → Table suggestion", () => {
    it("should suggest table for new BC based on similar BCs in repository", () => {
      const newObjects = [makeObj("AC Account BC", "business_component")];
      const repository = [
        makeObj("CX Account BC", "business_component", { TABLE: "S_ORG_EXT" }),
      ];

      const result = autoWireDependencies({ newObjects, repository });

      const tableSuggestion = result.missingDependencies.find(
        (d) => d.from.name === "AC Account BC" && d.to.type === "table",
      );
      expect(tableSuggestion).toBeDefined();
      expect(tableSuggestion!.to.name).toBe("S_ORG_EXT");
      expect(tableSuggestion!.suggestion).toBe("link");
    });

    it("should not suggest table if BC already has TABLE property", () => {
      const newObjects = [makeObj("AC Order BC", "business_component", { TABLE: "S_ORDER" })];
      const repository: SiebelObject[] = [];

      const result = autoWireDependencies({ newObjects, repository });

      const tableSuggestion = result.missingDependencies.filter(
        (d) => d.from.name === "AC Order BC" && d.to.type === "table",
      );
      expect(tableSuggestion).toHaveLength(0);
    });
  });

  // AC4: Wired edges creation
  describe("AC4: Wired edges", () => {
    it("should create wired edges for all resolved dependencies", () => {
      const newObjects = [
        makeObj("AC Order List Applet", "applet", { BUS_COMP: "CX Order BC" }),
      ];
      const repository = [makeObj("CX Order BC", "business_component")];

      const result = autoWireDependencies({ newObjects, repository });

      expect(result.wiredEdges).toHaveLength(1);
      expect(result.wiredEdges[0]).toMatchObject({
        from: { name: "AC Order List Applet", type: "applet" },
        to: { name: "CX Order BC", type: "business_component" },
        relationType: "references",
      });
    });
  });

  // AC5: Report generation
  describe("AC5: Missing dependency report", () => {
    it("should generate markdown report with suggestions", () => {
      const newObjects = [
        makeObj("AC Order List Applet", "applet", { BUS_COMP: "AC Order BC" }),
        makeObj("AC Order View", "view", {}, [
          makeObj("AC Missing Applet", "applet"),
        ]),
      ];

      const result = autoWireDependencies({ newObjects, repository: [] });

      expect(result.report).toContain("AC Order BC");
      expect(result.report).toContain("AC Missing Applet");
      expect(result.report).toContain("Missing");
      expect(result.missingDependencies.length).toBeGreaterThanOrEqual(2);
    });
  });

  // AC6: Integration with scaffold and clone_adapt
  describe("AC6: Integration compatibility", () => {
    it("should accept ScaffoldResult objects as newObjects", () => {
      // Scaffold produces SiebelObject[] — auto-wiring should accept them
      const scaffoldOutput: SiebelObject[] = [
        makeObj("AC Account BC", "business_component"),
        makeObj("AC Account List Applet", "applet", { BUS_COMP: "AC Account BC" }),
        makeObj("AC Account View", "view", {}, [
          makeObj("AC Account List Applet", "applet"),
        ]),
      ];

      const result = autoWireDependencies({ newObjects: scaffoldOutput, repository: [] });

      // BC is in newObjects, so applet→BC should be wired, not missing
      const bcMissing = result.missingDependencies.filter(
        (d) => d.to.name === "AC Account BC" && d.to.type === "business_component",
      );
      expect(bcMissing).toHaveLength(0);
      expect(result.wiredEdges.some((e) => e.to.name === "AC Account BC")).toBe(true);
    });

    it("should handle empty inputs gracefully", () => {
      const result = autoWireDependencies({ newObjects: [], repository: [] });

      expect(result.missingDependencies).toHaveLength(0);
      expect(result.wiredEdges).toHaveLength(0);
      expect(result.report).toBeDefined();
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("should handle BO → BC dependency from Business Object children", () => {
      const newObjects = [
        makeObj("AC Order BO", "business_object", {}, [
          makeObj("AC Order BC", "business_component"),
          makeObj("AC Order Item BC", "business_component"),
        ]),
      ];

      const result = autoWireDependencies({ newObjects, repository: [] });

      // BO references BCs via children — should detect if BCs don't exist as top-level
      const boMissing = result.missingDependencies.filter(
        (d) => d.from.type === "business_object",
      );
      expect(boMissing.length).toBeGreaterThanOrEqual(2);
    });

    it("should deduplicate dependencies", () => {
      const newObjects = [
        makeObj("AC Applet A", "applet", { BUS_COMP: "AC BC" }),
        makeObj("AC Applet B", "applet", { BUS_COMP: "AC BC" }),
      ];

      const result = autoWireDependencies({ newObjects, repository: [] });

      // Both applets reference same BC — missing dep should appear for each applet
      const bcMissing = result.missingDependencies.filter(
        (d) => d.to.name === "AC BC",
      );
      expect(bcMissing).toHaveLength(2); // one per applet
    });
  });
});
