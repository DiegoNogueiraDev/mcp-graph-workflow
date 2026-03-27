import { describe, it, expect } from "vitest";
import { analyzeCrossProjectDeps } from "../../core/siebel/cross-project-analyzer.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account Applet", type: "applet", project: "Account Module" }),
  makeObj({ name: "Account BC", type: "business_component", project: "Account Module" }),
  makeObj({ name: "Order Applet", type: "applet", project: "Order Module" }),
  makeObj({ name: "Order BC", type: "business_component", project: "Order Module" }),
  makeObj({ name: "Shared BO", type: "business_object", project: "Common" }),
];

const DEPS: SiebelDependency[] = [
  { from: { name: "Account Applet", type: "applet" }, to: { name: "Account BC", type: "business_component" }, relationType: "references", inferred: true },
  { from: { name: "Order Applet", type: "applet" }, to: { name: "Account BC", type: "business_component" }, relationType: "references", inferred: true },
  { from: { name: "Order Applet", type: "applet" }, to: { name: "Order BC", type: "business_component" }, relationType: "references", inferred: true },
  { from: { name: "Account Applet", type: "applet" }, to: { name: "Shared BO", type: "business_object" }, relationType: "references", inferred: true },
  { from: { name: "Order Applet", type: "applet" }, to: { name: "Shared BO", type: "business_object" }, relationType: "references", inferred: true },
];

describe("cross-project-analyzer", () => {
  it("should identify cross-project dependencies", () => {
    const result = analyzeCrossProjectDeps(OBJECTS, DEPS);
    expect(result.crossProjectDeps.length).toBeGreaterThan(0);
    const orderToAccount = result.crossProjectDeps.find(
      (d) => d.fromProject === "Order Module" && d.toProject === "Account Module"
    );
    expect(orderToAccount).toBeDefined();
  });

  it("should not flag same-project dependencies", () => {
    const result = analyzeCrossProjectDeps(OBJECTS, DEPS);
    const sameProject = result.crossProjectDeps.filter((d) => d.fromProject === d.toProject);
    expect(sameProject.length).toBe(0);
  });

  it("should generate Mermaid diagram of inter-project deps", () => {
    const result = analyzeCrossProjectDeps(OBJECTS, DEPS);
    expect(result.mermaidDiagram).toContain("graph");
    expect(result.mermaidDiagram).toContain("Order Module");
    expect(result.mermaidDiagram).toContain("Account Module");
  });

  it("should generate deploy risk alerts", () => {
    const result = analyzeCrossProjectDeps(OBJECTS, DEPS);
    expect(result.deployRisks.length).toBeGreaterThan(0);
    const risk = result.deployRisks.find((r) => r.includes("Order Module"));
    expect(risk).toBeDefined();
  });

  it("should report project summary", () => {
    const result = analyzeCrossProjectDeps(OBJECTS, DEPS);
    expect(result.projectSummary.length).toBeGreaterThanOrEqual(3);
    const accountMod = result.projectSummary.find((s) => s.project === "Account Module");
    expect(accountMod).toBeDefined();
    expect(accountMod!.objectCount).toBe(2);
  });

  it("should handle objects without project", () => {
    const noProject = [makeObj({ name: "Orphan", type: "applet" })];
    const result = analyzeCrossProjectDeps(noProject, []);
    expect(result.crossProjectDeps).toEqual([]);
  });

  it("should handle empty input", () => {
    const result = analyzeCrossProjectDeps([], []);
    expect(result.crossProjectDeps).toEqual([]);
    expect(result.mermaidDiagram).toContain("graph");
  });
});
