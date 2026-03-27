import { describe, it, expect } from "vitest";
import { buildSiebelObjectContext } from "../../core/siebel/siebel-context-builder.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account", type: "business_component", project: "Custom",
    properties: [{ name: "TABLE", value: "S_ORG_EXT" }],
    children: [
      makeObj({ name: "Name", type: "field", parentName: "Account" }),
      makeObj({ name: "PreWrite", type: "escript", parentName: "Account",
        properties: [{ name: "SOURCE_CODE", value: "function PreWrite() { return; }" }, { name: "METHOD", value: "PreWrite" }],
      }),
      makeObj({ name: "DeDup", type: "user_property", parentName: "Account", properties: [{ name: "VALUE", value: "Y" }] }),
    ],
  }),
  makeObj({ name: "Account Applet", type: "applet",
    properties: [{ name: "BUS_COMP", value: "Account" }],
  }),
];

const DEPS: SiebelDependency[] = [
  { from: { name: "Account Applet", type: "applet" }, to: { name: "Account", type: "business_component" }, relationType: "references", inferred: true },
];

describe("siebel-context-builder", () => {
  it("should build context with definition, properties, children", () => {
    const ctx = buildSiebelObjectContext("Account", "business_component", OBJECTS, DEPS);
    expect(ctx).toContain("Account");
    expect(ctx).toContain("TABLE");
    expect(ctx).toContain("S_ORG_EXT");
  });

  it("should include scripts in context", () => {
    const ctx = buildSiebelObjectContext("Account", "business_component", OBJECTS, DEPS);
    expect(ctx).toContain("PreWrite");
    expect(ctx).toContain("function PreWrite");
  });

  it("should include bidirectional dependencies", () => {
    const ctx = buildSiebelObjectContext("Account", "business_component", OBJECTS, DEPS);
    expect(ctx).toContain("Account Applet");
    expect(ctx).toContain("references");
  });

  it("should include user properties", () => {
    const ctx = buildSiebelObjectContext("Account", "business_component", OBJECTS, DEPS);
    expect(ctx).toContain("DeDup");
  });

  it("should be token-efficient (compressed)", () => {
    const ctx = buildSiebelObjectContext("Account", "business_component", OBJECTS, DEPS);
    // Should be shorter than raw JSON
    const rawJson = JSON.stringify(OBJECTS[0]);
    expect(ctx.length).toBeLessThan(rawJson.length * 2);
  });

  it("should return empty for unknown object", () => {
    const ctx = buildSiebelObjectContext("NonExistent", "applet", OBJECTS, DEPS);
    expect(ctx).toContain("not found");
  });
});
