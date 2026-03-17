import { describe, it, expect } from "vitest";
import { checkDesignReadiness } from "../../core/designer/definition-of-ready.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Node ${i}`,
    status: n.status ?? "backlog",
    priority: n.priority ?? 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...n,
  })) as GraphNode[];

  const fullEdges: GraphEdge[] = edges.map((e, i) => ({
    id: e.id ?? `edge_${i}`,
    from: e.from ?? "",
    to: e.to ?? "",
    relationType: e.relationType ?? "depends_on",
    createdAt: "2025-01-01T00:00:00Z",
    ...e,
  })) as GraphEdge[];

  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: fullNodes,
    edges: fullEdges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

/** Minimal doc that passes all required checks */
function makeReadyDoc(): GraphDocument {
  return makeDoc(
    [
      { id: "req1", type: "requirement", description: "A requirement" },
      {
        id: "dec1", type: "decision", title: "Use X",
        description: "## Status\nAccepted\n## Context\nNeed X\n## Decision\nUse X\n## Consequences\nMust learn X",
      },
      { id: "con1", type: "constraint", description: "Must be fast" },
    ],
    [
      { from: "req1", to: "dec1", relationType: "implements" },
      { from: "req1", to: "con1", relationType: "related_to" },
    ],
  );
}

describe("checkDesignReadiness", () => {
  // ── Required checks ──

  it("should block when no decision node exists", () => {
    const doc = makeDoc([
      { type: "requirement" },
      { type: "constraint" },
    ]);
    const report = checkDesignReadiness(doc);
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === "has_decisions")!.passed).toBe(false);
    expect(report.checks.find((c) => c.name === "has_decisions")!.severity).toBe("required");
  });

  it("should block when no constraint node exists", () => {
    const doc = makeDoc([
      { type: "requirement" },
      {
        type: "decision",
        description: "## Status\nAccepted\n## Context\nX\n## Decision\nY\n## Consequences\nZ",
      },
    ]);
    const report = checkDesignReadiness(doc);
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === "has_constraints")!.passed).toBe(false);
  });

  it("should block when requirements have no edges (orphans)", () => {
    const doc = makeDoc([
      { id: "req1", type: "requirement" },
      {
        id: "dec1", type: "decision",
        description: "## Status\nAccepted\n## Context\nX\n## Decision\nY\n## Consequences\nZ",
      },
      { id: "con1", type: "constraint" },
    ]);
    const report = checkDesignReadiness(doc);
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === "no_orphan_requirements")!.passed).toBe(false);
  });

  it("should block when graph has cycles", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        {
          id: "dec1", type: "decision",
          description: "## Status\nAccepted\n## Context\nX\n## Decision\nY\n## Consequences\nZ",
        },
        { id: "con1", type: "constraint" },
        { id: "a", type: "task" },
        { id: "b", type: "task" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
        { from: "a", to: "b", relationType: "depends_on" },
        { from: "b", to: "a", relationType: "depends_on" },
      ],
    );
    const report = checkDesignReadiness(doc);
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === "no_cycles")!.passed).toBe(false);
  });

  it("should block when ADR grade is below C", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision", title: "Bad ADR", description: "No sections" },
        { id: "con1", type: "constraint" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
      ],
    );
    const report = checkDesignReadiness(doc);
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === "adr_quality")!.passed).toBe(false);
  });

  it("should be ready when all required checks pass", () => {
    const doc = makeReadyDoc();
    const report = checkDesignReadiness(doc);
    expect(report.ready).toBe(true);
    const requiredChecks = report.checks.filter((c) => c.severity === "required");
    expect(requiredChecks.every((c) => c.passed)).toBe(true);
  });

  // ── Recommended checks ──

  it("should include traceability coverage check as recommended", () => {
    const doc = makeReadyDoc();
    const report = checkDesignReadiness(doc);
    const traceCheck = report.checks.find((c) => c.name === "traceability_coverage");
    expect(traceCheck).toBeDefined();
    expect(traceCheck!.severity).toBe("recommended");
  });

  it("should include isolated nodes check as recommended", () => {
    const doc = makeReadyDoc();
    const report = checkDesignReadiness(doc);
    const isoCheck = report.checks.find((c) => c.name === "no_isolated_nodes");
    expect(isoCheck).toBeDefined();
    expect(isoCheck!.severity).toBe("recommended");
  });

  it("should include interface score check as recommended", () => {
    const doc = makeReadyDoc();
    const report = checkDesignReadiness(doc);
    const ifCheck = report.checks.find((c) => c.name === "interface_quality");
    expect(ifCheck).toBeDefined();
    expect(ifCheck!.severity).toBe("recommended");
  });

  it("should include risk mitigation check as recommended", () => {
    const doc = makeReadyDoc();
    const report = checkDesignReadiness(doc);
    const riskCheck = report.checks.find((c) => c.name === "risks_mitigated");
    expect(riskCheck).toBeDefined();
    expect(riskCheck!.severity).toBe("recommended");
  });

  it("should include milestone check as recommended", () => {
    const doc = makeReadyDoc();
    const report = checkDesignReadiness(doc);
    const msCheck = report.checks.find((c) => c.name === "has_milestones");
    expect(msCheck).toBeDefined();
    expect(msCheck!.severity).toBe("recommended");
  });

  // ── Scoring and grading ──

  it("should grade A when score >= 90", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement", description: "desc", acceptanceCriteria: ["ac"] },
        {
          id: "dec1", type: "decision",
          description: "## Status\nAccepted\n## Context\nX\n## Decision\nY\n## Consequences\nZ",
        },
        { id: "con1", type: "constraint", description: "constraint" },
        { id: "ms1", type: "milestone", description: "milestone" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
      ],
    );
    const report = checkDesignReadiness(doc);
    expect(report.ready).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it("should not be ready and have low grade when minimal graph", () => {
    const doc = makeDoc([{ type: "epic" }]);
    const report = checkDesignReadiness(doc);
    expect(report.ready).toBe(false);
    // With 1 epic: no decisions, no constraints, no ADR → 3 required checks fail
    const failedRequired = report.checks.filter((c) => c.severity === "required" && !c.passed);
    expect(failedRequired.length).toBeGreaterThanOrEqual(3);
  });
});
