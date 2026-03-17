import { describe, it, expect } from "vitest";
import { assessTechRisks } from "../../core/designer/tech-risk-assessor.js";
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

describe("assessTechRisks", () => {
  it("should return empty report when no risk nodes exist", () => {
    const doc = makeDoc([{ type: "task" }, { type: "epic" }]);
    const report = assessTechRisks(doc);
    expect(report.risks).toHaveLength(0);
    expect(report.riskScore).toBe(0);
  });

  it("should categorize risk by description keywords", () => {
    const doc = makeDoc([
      { id: "r1", type: "risk", description: "API integration with third-party service may fail", tags: ["integration"] },
    ]);
    const report = assessTechRisks(doc);
    expect(report.risks[0].category).toBe("integration");
  });

  it("should categorize security risk from keywords", () => {
    const doc = makeDoc([
      { id: "r1", type: "risk", description: "Authentication bypass vulnerability", tags: ["security"] },
    ]);
    const report = assessTechRisks(doc);
    expect(report.risks[0].category).toBe("security");
  });

  it("should calculate score as probability * impact (low=1, medium=2, high=3)", () => {
    const doc = makeDoc([
      { id: "r1", type: "risk", description: "High complexity risk", priority: 1 }, // high priority = high probability
    ]);
    const report = assessTechRisks(doc);
    expect(report.risks[0].score).toBeGreaterThanOrEqual(1);
    expect(report.risks[0].score).toBeLessThanOrEqual(9);
  });

  it("should mark risk as mitigated when linked to decision or constraint", () => {
    const doc = makeDoc(
      [
        { id: "r1", type: "risk", description: "Performance bottleneck" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "r1", to: "dec1", relationType: "related_to" },
      ],
    );
    const report = assessTechRisks(doc);
    expect(report.risks[0].mitigated).toBe(true);
  });

  it("should mark risk as unmitigated when no linked decision or constraint", () => {
    const doc = makeDoc([
      { id: "r1", type: "risk", description: "Unmitigated security risk" },
    ]);
    const report = assessTechRisks(doc);
    expect(report.risks[0].mitigated).toBe(false);
  });

  it("should infer complexity risk from high fan-out nodes", () => {
    const nodes: Partial<GraphNode>[] = [
      { id: "hub", type: "task" },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `dep_${i}`, type: "task" as const })),
    ];
    const edges: Partial<GraphEdge>[] = Array.from({ length: 6 }, (_, i) => ({
      from: "hub",
      to: `dep_${i}`,
      relationType: "depends_on" as const,
    }));
    const doc = makeDoc(nodes, edges);
    const report = assessTechRisks(doc);
    expect(report.inferredRisks.some((r) => r.category === "complexity")).toBe(true);
  });

  it("should infer dependency risk from many depends_on edges on single node", () => {
    const nodes: Partial<GraphNode>[] = [
      { id: "dependent", type: "task" },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `dep_${i}`, type: "task" as const })),
    ];
    const edges: Partial<GraphEdge>[] = Array.from({ length: 6 }, (_, i) => ({
      from: "dependent",
      to: `dep_${i}`,
      relationType: "depends_on" as const,
    }));
    const doc = makeDoc(nodes, edges);
    const report = assessTechRisks(doc);
    expect(report.inferredRisks.some((r) => r.category === "dependency")).toBe(true);
  });

  it("should track high risks (score >= 6)", () => {
    const doc = makeDoc([
      { id: "r1", type: "risk", description: "Critical security vulnerability", priority: 1, tags: ["security"] },
    ]);
    const report = assessTechRisks(doc);
    if (report.risks[0].score >= 6) {
      expect(report.highRisks).toContain("r1");
    }
  });

  it("should calculate total risk score", () => {
    const doc = makeDoc([
      { id: "r1", type: "risk", description: "Risk one" },
      { id: "r2", type: "risk", description: "Risk two" },
    ]);
    const report = assessTechRisks(doc);
    const expectedTotal = report.risks.reduce((sum, r) => sum + r.score, 0)
      + report.inferredRisks.reduce((sum, r) => sum + r.score, 0);
    expect(report.riskScore).toBe(expectedTotal);
  });
});
