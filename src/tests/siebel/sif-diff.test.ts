import { describe, it, expect } from "vitest";
import {
  diffSifObjects,
  formatDiffMarkdown,
} from "../../core/siebel/sif-diff.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(
  overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] },
): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const BASE_OBJECTS: SiebelObject[] = [
  makeObj({
    name: "CX Account List Applet", type: "applet",
    properties: [
      { name: "BUS_COMP", value: "Account" },
      { name: "CLASS", value: "CSSFrameList" },
    ],
    children: [
      makeObj({ name: "Name", type: "list_column", parentName: "CX Account List Applet",
        properties: [{ name: "FIELD", value: "Name" }, { name: "WIDTH", value: "200" }] }),
      makeObj({ name: "Status", type: "list_column", parentName: "CX Account List Applet",
        properties: [{ name: "FIELD", value: "Status" }, { name: "WIDTH", value: "100" }] }),
    ],
  }),
  makeObj({
    name: "CX Account", type: "business_component",
    properties: [
      { name: "TABLE", value: "S_ORG_EXT" },
      { name: "CLASS", value: "CSSBCBase" },
    ],
    children: [],
  }),
];

describe("sif-diff", () => {
  describe("AC1: identifies added, removed, and modified objects", () => {
    it("should detect added objects", () => {
      const target = [
        ...BASE_OBJECTS,
        makeObj({ name: "CX New View", type: "view", properties: [] }),
      ];

      const result = diffSifObjects(BASE_OBJECTS, target);

      expect(result.added).toHaveLength(1);
      expect(result.added[0].name).toBe("CX New View");
      expect(result.removed).toHaveLength(0);
    });

    it("should detect removed objects", () => {
      const target = [BASE_OBJECTS[0]]; // only applet, BC removed

      const result = diffSifObjects(BASE_OBJECTS, target);

      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].name).toBe("CX Account");
    });

    it("should detect modified objects (property changed)", () => {
      const target: SiebelObject[] = [
        makeObj({
          name: "CX Account List Applet", type: "applet",
          properties: [
            { name: "BUS_COMP", value: "Contact" }, // changed!
            { name: "CLASS", value: "CSSFrameList" },
          ],
          children: BASE_OBJECTS[0].children,
        }),
        BASE_OBJECTS[1],
      ];

      const result = diffSifObjects(BASE_OBJECTS, target);

      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].objectName).toBe("CX Account List Applet");
    });
  });

  describe("AC2: lists property changes with old/new values", () => {
    it("should show old and new values for modified properties", () => {
      const target: SiebelObject[] = [
        makeObj({
          name: "CX Account List Applet", type: "applet",
          properties: [
            { name: "BUS_COMP", value: "Contact" },
            { name: "CLASS", value: "CSSFrameList" },
            { name: "COMMENTS", value: "New comment" }, // added prop
          ],
          children: BASE_OBJECTS[0].children,
        }),
        BASE_OBJECTS[1],
      ];

      const result = diffSifObjects(BASE_OBJECTS, target);
      const mod = result.modified[0];

      const busCompChange = mod.propertyChanges.find((c) => c.name === "BUS_COMP");
      expect(busCompChange).toBeDefined();
      expect(busCompChange!.oldValue).toBe("Account");
      expect(busCompChange!.newValue).toBe("Contact");

      const addedProp = mod.propertyChanges.find((c) => c.name === "COMMENTS");
      expect(addedProp).toBeDefined();
      expect(addedProp!.changeType).toBe("added");
    });
  });

  describe("AC3: diff of children with granularity", () => {
    it("should detect added children", () => {
      const target: SiebelObject[] = [
        makeObj({
          name: "CX Account List Applet", type: "applet",
          properties: BASE_OBJECTS[0].properties,
          children: [
            ...BASE_OBJECTS[0].children,
            makeObj({ name: "Email", type: "list_column", parentName: "CX Account List Applet",
              properties: [{ name: "FIELD", value: "Email" }] }),
          ],
        }),
        BASE_OBJECTS[1],
      ];

      const result = diffSifObjects(BASE_OBJECTS, target);
      const mod = result.modified[0];

      expect(mod.childChanges.added).toHaveLength(1);
      expect(mod.childChanges.added[0].name).toBe("Email");
    });

    it("should detect removed children", () => {
      const target: SiebelObject[] = [
        makeObj({
          name: "CX Account List Applet", type: "applet",
          properties: BASE_OBJECTS[0].properties,
          children: [BASE_OBJECTS[0].children[0]], // only Name, Status removed
        }),
        BASE_OBJECTS[1],
      ];

      const result = diffSifObjects(BASE_OBJECTS, target);
      const mod = result.modified[0];

      expect(mod.childChanges.removed).toHaveLength(1);
      expect(mod.childChanges.removed[0].name).toBe("Status");
    });
  });

  describe("AC4: output in JSON structured and Markdown", () => {
    it("should return structured JSON result", () => {
      const target = [
        ...BASE_OBJECTS,
        makeObj({ name: "CX New View", type: "view", properties: [] }),
      ];

      const result = diffSifObjects(BASE_OBJECTS, target);

      expect(result).toHaveProperty("added");
      expect(result).toHaveProperty("removed");
      expect(result).toHaveProperty("modified");
      expect(result).toHaveProperty("unchanged");
      expect(result).toHaveProperty("summary");
    });

    it("should produce readable Markdown output", () => {
      const target = [
        ...BASE_OBJECTS,
        makeObj({ name: "CX New View", type: "view", properties: [] }),
      ];

      const result = diffSifObjects(BASE_OBJECTS, target);
      const md = formatDiffMarkdown(result);

      expect(md).toContain("# SIF Diff");
      expect(md).toContain("CX New View");
      expect(md).toContain("Added");
    });
  });

  describe("edge cases", () => {
    it("should handle identical inputs", () => {
      const result = diffSifObjects(BASE_OBJECTS, BASE_OBJECTS);

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.unchanged).toBe(2);
    });

    it("should handle empty inputs", () => {
      const result = diffSifObjects([], []);

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
    });

    it("should handle base empty, target with objects", () => {
      const result = diffSifObjects([], BASE_OBJECTS);

      expect(result.added).toHaveLength(2);
      expect(result.removed).toHaveLength(0);
    });
  });
});
