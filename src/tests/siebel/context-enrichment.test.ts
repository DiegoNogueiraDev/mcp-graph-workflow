import { describe, it, expect } from "vitest";
import {
  enrichSifContext,
  type EnrichmentResult,
} from "../../core/siebel/context-enrichment.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

function makeObj(name: string, type: SiebelObject["type"], props: Record<string, string> = {}, children: SiebelObject[] = []): SiebelObject {
  return { name, type, properties: Object.entries(props).map(([k, v]) => ({ name: k, value: v })), children };
}

function makeDep(from: string, fromType: SiebelObject["type"], to: string, toType: SiebelObject["type"]): SiebelDependency {
  return { from: { name: from, type: fromType }, to: { name: to, type: toType }, relationType: "references" };
}

describe("context-enrichment", () => {
  it("should generate summary of what the SIF does", () => {
    const objects = [
      makeObj("CX Account BC", "business_component", { TABLE: "S_ORG_EXT" }),
      makeObj("CX Account Applet", "applet", { BUS_COMP: "CX Account BC" }),
    ];

    const result = enrichSifContext({ objects, dependencies: [] });

    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.summary).toContain("Account");
  });

  it("should list what the SIF depends on", () => {
    const objects = [makeObj("CX Account Applet", "applet", { BUS_COMP: "CX Account BC" })];
    const deps = [makeDep("CX Account Applet", "applet", "CX Account BC", "business_component")];

    const result = enrichSifContext({ objects, dependencies: deps });

    expect(result.dependsOn.length).toBeGreaterThanOrEqual(1);
  });

  it("should list what uses this SIF", () => {
    const objects = [makeObj("CX Account BC", "business_component")];
    const deps = [makeDep("CX Account Applet", "applet", "CX Account BC", "business_component")];

    const result = enrichSifContext({ objects, dependencies: deps });

    expect(result.usedBy.length).toBeGreaterThanOrEqual(1);
  });

  it("should detect object types present", () => {
    const objects = [
      makeObj("CX BC", "business_component"),
      makeObj("CX Applet", "applet"),
      makeObj("CX View", "view"),
    ];

    const result = enrichSifContext({ objects, dependencies: [] });

    expect(result.objectTypes).toContain("business_component");
    expect(result.objectTypes).toContain("applet");
    expect(result.objectTypes).toContain("view");
  });

  it("should handle empty input", () => {
    const result = enrichSifContext({ objects: [], dependencies: [] });

    expect(result.summary).toBeDefined();
    expect(result.dependsOn).toHaveLength(0);
    expect(result.usedBy).toHaveLength(0);
  });
});
