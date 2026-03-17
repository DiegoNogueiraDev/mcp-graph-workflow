import { describe, it, expect } from "vitest";
import { checkStatusFlow } from "../../core/validator/status-flow-checker.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Task ${i}`,
    status: n.status ?? "backlog",
    priority: n.priority ?? 3,
    createdAt: n.createdAt ?? "2025-01-01T00:00:00Z",
    updatedAt: n.updatedAt ?? "2025-01-01T00:00:00Z",
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

describe("checkStatusFlow", () => {
  it("should return 100% compliance when no done tasks exist", () => {
    const doc = makeDoc([{ type: "task", status: "backlog" }]);
    const report = checkStatusFlow(doc);
    expect(report.complianceRate).toBe(100);
    expect(report.violations).toHaveLength(0);
  });

  it("should detect done task that never transitioned (createdAt === updatedAt)", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    ]);
    const report = checkStatusFlow(doc);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].nodeId).toBe("t1");
    expect(report.complianceRate).toBe(0);
  });

  it("should pass when done task has different updatedAt", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
    ]);
    const report = checkStatusFlow(doc);
    expect(report.violations).toHaveLength(0);
    expect(report.complianceRate).toBe(100);
  });

  it("should calculate compliance rate correctly with mixed tasks", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
      { id: "t2", type: "task", status: "done", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    ]);
    const report = checkStatusFlow(doc);
    expect(report.violations).toHaveLength(1);
    expect(report.complianceRate).toBe(50);
  });

  it("should only check task and subtask types", () => {
    const doc = makeDoc([
      { type: "requirement", status: "done", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    ]);
    const report = checkStatusFlow(doc);
    expect(report.violations).toHaveLength(0);
    expect(report.complianceRate).toBe(100);
  });

  it("should handle empty graph", () => {
    const doc = makeDoc();
    const report = checkStatusFlow(doc);
    expect(report.complianceRate).toBe(100);
    expect(report.violations).toHaveLength(0);
  });
});
