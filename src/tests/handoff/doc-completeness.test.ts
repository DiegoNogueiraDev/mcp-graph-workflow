import { describe, it, expect } from "vitest";
import { checkDocCompleteness } from "../../core/handoff/doc-completeness.js";
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
    updatedAt: n.updatedAt ?? "2025-01-02T00:00:00Z",
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

describe("checkDocCompleteness", () => {
  it("should return 100% when all nodes have descriptions", () => {
    const doc = makeDoc([
      { id: "t1", description: "A description" },
      { id: "t2", description: "Another description" },
    ]);
    const report = checkDocCompleteness(doc);
    expect(report.coverageRate).toBe(100);
    expect(report.nodesWithoutDescription).toHaveLength(0);
  });

  it("should return 0% when no nodes have descriptions", () => {
    const doc = makeDoc([
      { id: "t1" },
      { id: "t2" },
    ]);
    const report = checkDocCompleteness(doc);
    expect(report.coverageRate).toBe(0);
    expect(report.nodesWithoutDescription).toHaveLength(2);
  });

  it("should calculate correct coverage rate", () => {
    const doc = makeDoc([
      { id: "t1", description: "Has desc" },
      { id: "t2" },
      { id: "t3", description: "Also has desc" },
    ]);
    const report = checkDocCompleteness(doc);
    expect(report.coverageRate).toBe(67);
    expect(report.descriptionsPresent).toBe(2);
    expect(report.totalNodes).toBe(3);
  });

  it("should treat empty/whitespace descriptions as missing", () => {
    const doc = makeDoc([
      { id: "t1", description: "" },
      { id: "t2", description: "   " },
    ]);
    const report = checkDocCompleteness(doc);
    expect(report.coverageRate).toBe(0);
    expect(report.nodesWithoutDescription).toHaveLength(2);
  });

  it("should list nodes without descriptions", () => {
    const doc = makeDoc([
      { id: "t1", title: "Task 1", description: "OK" },
      { id: "t2", title: "Missing Desc" },
    ]);
    const report = checkDocCompleteness(doc);
    expect(report.nodesWithoutDescription).toHaveLength(1);
    expect(report.nodesWithoutDescription[0].nodeId).toBe("t2");
    expect(report.nodesWithoutDescription[0].title).toBe("Missing Desc");
  });

  it("should return 100% for empty graph", () => {
    const doc = makeDoc();
    const report = checkDocCompleteness(doc);
    expect(report.coverageRate).toBe(100);
    expect(report.totalNodes).toBe(0);
  });

  it("should count all node types", () => {
    const doc = makeDoc([
      { type: "epic", description: "Epic desc" },
      { type: "requirement", description: "Req desc" },
      { type: "task" },
    ]);
    const report = checkDocCompleteness(doc);
    expect(report.totalNodes).toBe(3);
    expect(report.descriptionsPresent).toBe(2);
  });

  it("should handle undefined description", () => {
    const doc = makeDoc([
      { id: "t1", description: undefined },
    ]);
    const report = checkDocCompleteness(doc);
    expect(report.coverageRate).toBe(0);
  });
});
