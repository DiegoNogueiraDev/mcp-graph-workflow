import { describe, it, expect } from "vitest";
import { mapLovDependencies } from "../../core/siebel/lov-mapper.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account BC", type: "business_component", children: [
    makeObj({ name: "SetField", type: "escript", parentName: "Account BC",
      properties: [{ name: "SOURCE_CODE", value: 'var val = TheApplication().InvokeMethod("LookupValue", "STATUS_TYPE", "Active");\nvar msg = TheApplication().InvokeMethod("LookupValue", "MSG_TYPE", "Error");' }, { name: "METHOD", value: "SetField" }],
    }),
  ]}),
  makeObj({ name: "Contact BC", type: "business_component", children: [
    makeObj({ name: "Validate", type: "escript", parentName: "Contact BC",
      properties: [{ name: "SOURCE_CODE", value: 'TheApplication().InvokeMethod("LookupValue", "STATUS_TYPE", "Inactive");' }, { name: "METHOD", value: "Validate" }],
    }),
  ]}),
];

describe("lov-mapper", () => {
  it("should map LOV types to dependent objects", () => {
    const result = mapLovDependencies(OBJECTS);
    const statusLov = result.lovTypes.find((l) => l.name === "STATUS_TYPE");
    expect(statusLov).toBeDefined();
    expect(statusLov!.dependents.length).toBe(2);
  });

  it("should list LOV values used", () => {
    const result = mapLovDependencies(OBJECTS);
    const statusLov = result.lovTypes.find((l) => l.name === "STATUS_TYPE");
    expect(statusLov!.values).toContain("Active");
    expect(statusLov!.values).toContain("Inactive");
  });

  it("should count total LOV types", () => {
    const result = mapLovDependencies(OBJECTS);
    expect(result.totalLovTypes).toBe(2); // STATUS_TYPE + MSG_TYPE
  });

  it("should handle empty input", () => {
    const result = mapLovDependencies([]);
    expect(result.lovTypes).toEqual([]);
    expect(result.totalLovTypes).toBe(0);
  });
});
