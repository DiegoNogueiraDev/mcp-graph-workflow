import { describe, it, expect } from "vitest";
import { analyzeProfileAttrFlow } from "../../core/siebel/profileattr-flow.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Form Applet", type: "applet", children: [
    makeObj({ name: "PreInvoke", type: "escript", parentName: "Form Applet",
      properties: [{ name: "SOURCE_CODE", value: 'TheApplication().SetProfileAttr("UserId", "123");\nTheApplication().SetProfileAttr("Action", "Create");' }, { name: "METHOD", value: "PreInvoke" }],
    }),
  ]}),
  makeObj({ name: "List Applet", type: "applet", children: [
    makeObj({ name: "Load", type: "escript", parentName: "List Applet",
      properties: [{ name: "SOURCE_CODE", value: 'var id = TheApplication().GetProfileAttr("UserId");\nvar orphan = TheApplication().GetProfileAttr("Unknown");' }, { name: "METHOD", value: "Load" }],
    }),
  ]}),
];

describe("profileattr-flow", () => {
  it("should map producers and consumers", () => {
    const result = analyzeProfileAttrFlow(OBJECTS);
    const userId = result.attrs.find((a) => a.name === "UserId");
    expect(userId).toBeDefined();
    expect(userId!.producers.length).toBe(1);
    expect(userId!.consumers.length).toBe(1);
  });

  it("should detect orphan attrs (get without set)", () => {
    const result = analyzeProfileAttrFlow(OBJECTS);
    const unknown = result.attrs.find((a) => a.name === "Unknown");
    expect(unknown).toBeDefined();
    expect(unknown!.isOrphan).toBe(true);
    expect(unknown!.producers.length).toBe(0);
  });

  it("should detect unused attrs (set without get)", () => {
    const result = analyzeProfileAttrFlow(OBJECTS);
    const action = result.attrs.find((a) => a.name === "Action");
    expect(action).toBeDefined();
    expect(action!.isUnused).toBe(true);
    expect(action!.consumers.length).toBe(0);
  });

  it("should handle empty input", () => {
    const result = analyzeProfileAttrFlow([]);
    expect(result.attrs).toEqual([]);
  });
});
