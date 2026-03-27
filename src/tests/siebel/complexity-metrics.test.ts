import { describe, it, expect } from "vitest";
import { calculateComplexity } from "../../core/siebel/complexity-metrics.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Simple BC", type: "business_component", children: [
    makeObj({ name: "Name", type: "field", parentName: "Simple BC" }),
    makeObj({ name: "Status", type: "field", parentName: "Simple BC" }),
  ]}),
  makeObj({ name: "Complex BC", type: "business_component", children: [
    ...Array.from({ length: 20 }, (_, i) => makeObj({ name: `Field${i}`, type: "field", parentName: "Complex BC" })),
    ...Array.from({ length: 5 }, (_, i) => makeObj({ name: `Script${i}`, type: "escript", parentName: "Complex BC" })),
    ...Array.from({ length: 10 }, (_, i) => makeObj({ name: `Prop${i}`, type: "user_property", parentName: "Complex BC" })),
  ]}),
];

const DEPS: SiebelDependency[] = [
  { from: { name: "Complex BC", type: "business_component" }, to: { name: "Simple BC", type: "business_component" }, relationType: "linked_to", inferred: true },
];

describe("complexity-metrics", () => {
  it("should calculate field_count, script_count, user_prop_count", () => {
    const results = calculateComplexity(OBJECTS, DEPS);
    const complex = results.find((r) => r.name === "Complex BC");
    expect(complex).toBeDefined();
    expect(complex!.metrics.fieldCount).toBe(20);
    expect(complex!.metrics.scriptCount).toBe(5);
    expect(complex!.metrics.userPropCount).toBe(10);
  });

  it("should calculate dependency_count", () => {
    const results = calculateComplexity(OBJECTS, DEPS);
    const complex = results.find((r) => r.name === "Complex BC");
    expect(complex!.metrics.dependencyCount).toBe(1);
  });

  it("should assign complexity level", () => {
    const results = calculateComplexity(OBJECTS, DEPS);
    const complex = results.find((r) => r.name === "Complex BC");
    expect(["medium", "high", "critical"]).toContain(complex!.level);
    const simple = results.find((r) => r.name === "Simple BC");
    expect(simple!.level).toBe("low");
  });

  it("should rank by complexity score descending", () => {
    const results = calculateComplexity(OBJECTS, DEPS);
    expect(results[0].name).toBe("Complex BC");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("should handle empty input", () => {
    const results = calculateComplexity([], []);
    expect(results).toEqual([]);
  });
});
