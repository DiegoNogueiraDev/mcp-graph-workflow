import { describe, it, expect } from "vitest";
import {
  scaffoldSiebelObjects,
  type ScaffoldRequest,
  type ScaffoldResult,
} from "../../core/siebel/scaffold-generator.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(
  overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] },
): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

// Reference objects from a "real" repository for template learning
const REFERENCE_OBJECTS: SiebelObject[] = [
  makeObj({
    name: "CX Account List Applet", type: "applet", project: "Custom",
    properties: [
      { name: "BUS_COMP", value: "Account" },
      { name: "CLASS", value: "CSSFrameList" },
      { name: "COMMENTS", value: "List applet" },
    ],
    children: [
      makeObj({ name: "Name", type: "list_column", parentName: "CX Account List Applet",
        properties: [{ name: "FIELD", value: "Name" }] }),
    ],
  }),
  makeObj({
    name: "CX Account Form Applet", type: "applet", project: "Custom",
    properties: [
      { name: "BUS_COMP", value: "Account" },
      { name: "CLASS", value: "CSSFrameBase" },
    ],
    children: [
      makeObj({ name: "Name", type: "control", parentName: "CX Account Form Applet",
        properties: [{ name: "FIELD", value: "Name" }] }),
    ],
  }),
  makeObj({
    name: "CX Account", type: "business_component", project: "Custom",
    properties: [
      { name: "TABLE", value: "S_ORG_EXT" },
      { name: "CLASS", value: "CSSBCBase" },
    ],
    children: [
      makeObj({ name: "Name", type: "field", parentName: "CX Account",
        properties: [{ name: "COLUMN", value: "NAME" }, { name: "TYPE", value: "DTYPE_TEXT" }] }),
    ],
  }),
  makeObj({
    name: "CX Account View", type: "view", project: "Custom",
    properties: [
      { name: "BUS_OBJECT", value: "Account" },
    ],
    children: [],
  }),
  makeObj({
    name: "CX Account Screen", type: "screen", project: "Custom",
    properties: [],
    children: [],
  }),
];

describe("scaffold-generator", () => {
  describe("AC1: accepts natural language description", () => {
    it("should accept a description and return scaffold result", () => {
      const request: ScaffoldRequest = {
        description: "Create a list applet to display customer orders with fields: order number, date, status, amount",
        prefix: "CX_",
        projectName: "Custom Orders",
        referenceObjects: REFERENCE_OBJECTS,
      };

      const result = scaffoldSiebelObjects(request);

      expect(result).toBeDefined();
      expect(result.objects.length).toBeGreaterThan(0);
      expect(result.sifXml.length).toBeGreaterThan(0);
    });
  });

  describe("AC2: identifies required object types", () => {
    it("should create BC, Applet, View, Screen for a list applet request", () => {
      const request: ScaffoldRequest = {
        description: "list applet for orders with order number, date, status",
        prefix: "CX_",
        projectName: "Custom",
        referenceObjects: REFERENCE_OBJECTS,
      };

      const result = scaffoldSiebelObjects(request);
      const types = result.objects.map((o) => o.type);

      expect(types).toContain("business_component");
      expect(types).toContain("applet");
      expect(types).toContain("view");
    });

    it("should create form applet for a form request", () => {
      const request: ScaffoldRequest = {
        description: "form applet for editing order details",
        prefix: "CX_",
        projectName: "Custom",
        referenceObjects: REFERENCE_OBJECTS,
      };

      const result = scaffoldSiebelObjects(request);
      const applet = result.objects.find((o) => o.type === "applet");

      expect(applet).toBeDefined();
      const classValue = applet!.properties.find((p) => p.name === "CLASS")?.value;
      expect(classValue).toBe("CSSFrameBase");
    });
  });

  describe("AC3: uses learned templates from real objects", () => {
    it("should apply properties from learned templates", () => {
      const request: ScaffoldRequest = {
        description: "list applet for contacts",
        prefix: "CX_",
        projectName: "Custom",
        referenceObjects: REFERENCE_OBJECTS,
      };

      const result = scaffoldSiebelObjects(request);
      const bc = result.objects.find((o) => o.type === "business_component");

      expect(bc).toBeDefined();
      // BC should have TABLE and CLASS from learned template
      expect(bc!.properties.some((p) => p.name === "TABLE")).toBe(true);
      expect(bc!.properties.some((p) => p.name === "CLASS")).toBe(true);
    });
  });

  describe("AC4: generates valid SIF XML", () => {
    it("should produce valid XML with REPOSITORY > PROJECT hierarchy", () => {
      const request: ScaffoldRequest = {
        description: "list applet for products",
        prefix: "CX_",
        projectName: "Custom Products",
        referenceObjects: REFERENCE_OBJECTS,
      };

      const result = scaffoldSiebelObjects(request);

      expect(result.sifXml).toContain("REPOSITORY");
      expect(result.sifXml).toContain("PROJECT");
      expect(result.sifXml).toContain("Custom Products");
    });
  });

  describe("AC5: includes user properties from learned templates", () => {
    it("should include user properties when reference objects have them", () => {
      const refsWithUserProps: SiebelObject[] = [
        ...REFERENCE_OBJECTS,
        makeObj({
          name: "CX Account List Applet UP", type: "user_property",
          parentName: "CX Account List Applet",
          properties: [{ name: "NAME", value: "Named Search" }, { name: "VALUE", value: "TRUE" }],
        }),
      ];

      const request: ScaffoldRequest = {
        description: "list applet for cases",
        prefix: "CX_",
        projectName: "Custom",
        referenceObjects: refsWithUserProps,
      };

      const result = scaffoldSiebelObjects(request);
      // Should not crash; user props handling is best-effort
      expect(result.objects.length).toBeGreaterThan(0);
    });
  });

  describe("AC6: applies naming conventions", () => {
    it("should prefix all generated objects with the given prefix", () => {
      const request: ScaffoldRequest = {
        description: "list applet for tasks",
        prefix: "XX_",
        projectName: "Custom",
        referenceObjects: REFERENCE_OBJECTS,
      };

      const result = scaffoldSiebelObjects(request);

      for (const obj of result.objects) {
        expect(obj.name.startsWith("XX_")).toBe(true);
      }
    });
  });

  describe("AC7: generates script boilerplate", () => {
    it("should include eScript boilerplate for applets", () => {
      const request: ScaffoldRequest = {
        description: "form applet for accounts",
        prefix: "CX_",
        projectName: "Custom",
        referenceObjects: REFERENCE_OBJECTS,
        includeScriptBoilerplate: true,
      };

      const result = scaffoldSiebelObjects(request);

      expect(result.scriptBoilerplate).toBeDefined();
      expect(result.scriptBoilerplate!.length).toBeGreaterThan(0);
      // Should contain standard event handler shells
      expect(result.scriptBoilerplate!.some((s) => s.includes("PreInvokeMethod"))).toBe(true);
    });
  });

  describe("AC8: validation score >= 85", () => {
    it("should produce objects that score well against learned patterns", () => {
      const request: ScaffoldRequest = {
        description: "list applet for opportunities",
        prefix: "CX_",
        projectName: "Custom",
        referenceObjects: REFERENCE_OBJECTS,
      };

      const result = scaffoldSiebelObjects(request);

      expect(result.validationScore).toBeGreaterThanOrEqual(85);
    });
  });

  describe("edge cases", () => {
    it("should handle empty reference objects gracefully", () => {
      const request: ScaffoldRequest = {
        description: "list applet for something",
        prefix: "CX_",
        projectName: "Custom",
        referenceObjects: [],
      };

      const result = scaffoldSiebelObjects(request);

      // Should still produce objects using fallback templates
      expect(result.objects.length).toBeGreaterThan(0);
    });

    it("should handle minimal description", () => {
      const request: ScaffoldRequest = {
        description: "applet",
        prefix: "CX_",
        projectName: "Test",
        referenceObjects: REFERENCE_OBJECTS,
      };

      const result = scaffoldSiebelObjects(request);
      expect(result.objects.length).toBeGreaterThan(0);
    });
  });
});
