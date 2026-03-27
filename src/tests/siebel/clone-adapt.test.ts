import { describe, it, expect } from "vitest";
import {
  cloneAndAdapt,
  type CloneAdaptRequest,
} from "../../core/siebel/clone-adapt.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(
  overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] },
): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const SOURCE_APPLET: SiebelObject = makeObj({
  name: "CX Account Form Applet", type: "applet", project: "Custom Account",
  properties: [
    { name: "BUS_COMP", value: "CX Account" },
    { name: "CLASS", value: "CSSFrameBase" },
    { name: "WEB_TEMPLATE", value: "CX Account Form Template" },
  ],
  children: [
    makeObj({
      name: "Name", type: "control", parentName: "CX Account Form Applet",
      properties: [{ name: "FIELD", value: "Name" }, { name: "HTML_TYPE", value: "Field" }],
    }),
    makeObj({
      name: "Status", type: "control", parentName: "CX Account Form Applet",
      properties: [{ name: "FIELD", value: "Status" }, { name: "HTML_TYPE", value: "Field" }],
    }),
    makeObj({
      name: "CX Account Form Applet_PreInvokeMethod", type: "escript",
      parentName: "CX Account Form Applet",
      properties: [
        { name: "SCRIPT", value: 'var bcAccount = this.BusComp();\nvar sName = bcAccount.GetFieldValue("CX Account Name");\nTheApplication().RaiseErrorText("Error in CX Account");' },
      ],
    }),
  ],
});

describe("clone-adapt", () => {
  describe("AC1: accepts source object and change list", () => {
    it("should accept source object and produce cloned result", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: { "CX Account": "XX Order" },
      };

      const result = cloneAndAdapt(request);

      expect(result).toBeDefined();
      expect(result.cloned.name).toBe("XX Order Form Applet");
    });
  });

  describe("AC2: clones complete object including children", () => {
    it("should deep clone all children", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: {},
      };

      const result = cloneAndAdapt(request);

      expect(result.cloned.children).toHaveLength(3);
      // Children should be new references (deep copy)
      expect(result.cloned.children[0]).not.toBe(SOURCE_APPLET.children[0]);
    });

    it("should preserve properties on children", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: {},
      };

      const result = cloneAndAdapt(request);
      const nameControl = result.cloned.children.find((c) => c.name === "Name");

      expect(nameControl).toBeDefined();
      expect(nameControl!.properties).toHaveLength(2);
    });
  });

  describe("AC3: renames all internal references consistently", () => {
    it("should rename parentName in children", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: {},
      };

      const result = cloneAndAdapt(request);

      for (const child of result.cloned.children) {
        expect(child.parentName).toBe("XX Order Form Applet");
      }
    });

    it("should rename BUS_COMP property when BC is in renames", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: { "CX Account": "XX Order" },
      };

      const result = cloneAndAdapt(request);
      const busComp = result.cloned.properties.find((p) => p.name === "BUS_COMP");

      expect(busComp).toBeDefined();
      expect(busComp!.value).toBe("XX Order");
    });

    it("should rename property values that match rename keys", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: { "CX Account Form Template": "XX Order Form Template" },
      };

      const result = cloneAndAdapt(request);
      const webTemplate = result.cloned.properties.find((p) => p.name === "WEB_TEMPLATE");

      expect(webTemplate!.value).toBe("XX Order Form Template");
    });
  });

  describe("AC4: adapts scripts with renamed references", () => {
    it("should replace BC name references in eScript content", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: { "CX Account": "XX Order" },
      };

      const result = cloneAndAdapt(request);
      const script = result.cloned.children.find((c) => c.type === "escript");

      expect(script).toBeDefined();
      const scriptContent = script!.properties.find((p) => p.name === "SCRIPT")?.value;
      expect(scriptContent).toContain("XX Order");
      expect(scriptContent).not.toContain("CX Account");
    });
  });

  describe("AC5: maintains web template structure", () => {
    it("should preserve structural properties (HTML_TYPE, positions)", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: {},
      };

      const result = cloneAndAdapt(request);
      const nameControl = result.cloned.children.find((c) => c.name === "Name");

      expect(nameControl!.properties.find((p) => p.name === "HTML_TYPE")?.value).toBe("Field");
    });
  });

  describe("AC6: generates diff between original and clone", () => {
    it("should include diff in result", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: { "CX Account": "XX Order" },
      };

      const result = cloneAndAdapt(request);

      expect(result.diff).toBeDefined();
      // The diff should show the name change as removed+added (different key)
      expect(result.diff.summary.addedCount + result.diff.summary.removedCount + result.diff.summary.modifiedCount).toBeGreaterThan(0);
    });
  });

  describe("AC7: fields add/remove", () => {
    it("should add new fields to the clone", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: {},
        addChildren: [
          makeObj({
            name: "Email", type: "control",
            properties: [{ name: "FIELD", value: "Email" }],
          }),
        ],
      };

      const result = cloneAndAdapt(request);
      const email = result.cloned.children.find((c) => c.name === "Email");

      expect(email).toBeDefined();
      expect(result.cloned.children).toHaveLength(4); // 3 original + 1 new
    });

    it("should remove specified children from the clone", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: {},
        removeChildren: ["Status"],
      };

      const result = cloneAndAdapt(request);
      const status = result.cloned.children.find((c) => c.name === "Status");

      expect(status).toBeUndefined();
      expect(result.cloned.children).toHaveLength(2); // 3 original - 1 removed
    });
  });

  describe("edge cases", () => {
    it("should handle empty renames", () => {
      const request: CloneAdaptRequest = {
        source: SOURCE_APPLET,
        newName: "XX Order Form Applet",
        renames: {},
      };

      const result = cloneAndAdapt(request);
      expect(result.cloned.name).toBe("XX Order Form Applet");
    });

    it("should handle object without children", () => {
      const simple = makeObj({
        name: "Simple BC", type: "business_component",
        properties: [{ name: "TABLE", value: "S_ORG_EXT" }],
      });

      const request: CloneAdaptRequest = {
        source: simple,
        newName: "New BC",
        renames: {},
      };

      const result = cloneAndAdapt(request);
      expect(result.cloned.name).toBe("New BC");
      expect(result.cloned.children).toHaveLength(0);
    });
  });
});
