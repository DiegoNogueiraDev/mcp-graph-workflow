import { describe, it, expect } from "vitest";
import { buildRuntimeDeps } from "../../core/siebel/runtime-dep-builder.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account BC", type: "business_component", children: [
    makeObj({ name: "BusComp_SetFieldValue", type: "escript", parentName: "Account BC",
      properties: [
        { name: "SOURCE_CODE", value: 'var bo = TheApplication().GetBusObject("Order");\nvar bc = bo.GetBusComp("Order Entry");\nvar svc = TheApplication().GetService("Validation BS");\nvar name = this.GetFieldValue("Name");' },
        { name: "METHOD", value: "BusComp_SetFieldValue" },
      ],
    }),
  ]}),
  makeObj({ name: "Order Entry", type: "business_component" }),
  makeObj({ name: "Validation BS", type: "business_service" }),
];

describe("runtime-dep-builder", () => {
  it("should extract runtime dependencies from eScript children", () => {
    const deps = buildRuntimeDeps(OBJECTS);
    expect(deps.length).toBeGreaterThan(0);
  });

  it("should create runtime_depends_on edges for GetBusObject refs", () => {
    const deps = buildRuntimeDeps(OBJECTS);
    const boDep = deps.find((d) => d.to.name === "Order" && d.to.type === "business_object");
    expect(boDep).toBeDefined();
    expect(boDep!.relationType).toBe("runtime_depends_on");
  });

  it("should create edges for GetService refs", () => {
    const deps = buildRuntimeDeps(OBJECTS);
    const svcDep = deps.find((d) => d.to.name === "Validation BS");
    expect(svcDep).toBeDefined();
  });

  it("should report runtime vs static summary", () => {
    const deps = buildRuntimeDeps(OBJECTS);
    expect(deps.every((d) => d.relationType === "runtime_depends_on")).toBe(true);
  });

  it("should handle objects without scripts", () => {
    const noScripts = [makeObj({ name: "Simple", type: "applet" })];
    const deps = buildRuntimeDeps(noScripts);
    expect(deps).toEqual([]);
  });
});
