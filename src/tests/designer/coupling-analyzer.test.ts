import { describe, it, expect } from "vitest";
import { analyzeCoupling } from "../../core/designer/coupling-analyzer.js";
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

describe("analyzeCoupling", () => {
  it("should return empty report for empty graph", () => {
    const doc = makeDoc();
    const report = analyzeCoupling(doc);
    expect(report.nodes).toHaveLength(0);
    expect(report.highCouplingNodes).toHaveLength(0);
    expect(report.isolatedNodes).toHaveLength(0);
  });

  it("should calculate fan-in and fan-out correctly", () => {
    const doc = makeDoc(
      [
        { id: "a", type: "task" },
        { id: "b", type: "task" },
        { id: "c", type: "task" },
      ],
      [
        { from: "a", to: "b", relationType: "depends_on" },
        { from: "a", to: "c", relationType: "depends_on" },
      ],
    );
    const report = analyzeCoupling(doc);
    const nodeA = report.nodes.find((n) => n.nodeId === "a");
    expect(nodeA!.fanOut).toBe(2);
    expect(nodeA!.fanIn).toBe(0);

    const nodeB = report.nodes.find((n) => n.nodeId === "b");
    expect(nodeB!.fanIn).toBe(1);
    expect(nodeB!.fanOut).toBe(0);
  });

  it("should calculate instability (fanOut / (fanIn + fanOut))", () => {
    const doc = makeDoc(
      [
        { id: "a", type: "task" },
        { id: "b", type: "task" },
        { id: "c", type: "task" },
      ],
      [
        { from: "a", to: "b", relationType: "depends_on" },
        { from: "c", to: "a", relationType: "depends_on" },
      ],
    );
    const report = analyzeCoupling(doc);
    const nodeA = report.nodes.find((n) => n.nodeId === "a");
    // a: fanIn=1 (c→a), fanOut=1 (a→b) → instability = 1/(1+1) = 0.5
    expect(nodeA!.instability).toBeCloseTo(0.5);
  });

  it("should mark high coupling nodes (fan-in + fan-out > 5)", () => {
    const doc = makeDoc(
      [
        { id: "hub" },
        { id: "a" }, { id: "b" }, { id: "c" },
        { id: "d" }, { id: "e" }, { id: "f" },
      ],
      [
        { from: "a", to: "hub", relationType: "depends_on" },
        { from: "b", to: "hub", relationType: "depends_on" },
        { from: "c", to: "hub", relationType: "depends_on" },
        { from: "hub", to: "d", relationType: "depends_on" },
        { from: "hub", to: "e", relationType: "depends_on" },
        { from: "hub", to: "f", relationType: "depends_on" },
      ],
    );
    const report = analyzeCoupling(doc);
    expect(report.highCouplingNodes).toContain("hub");
  });

  it("should detect isolated nodes (has parentId but no edges)", () => {
    const doc = makeDoc(
      [
        { id: "root", type: "epic" },
        { id: "connected", type: "task", parentId: "root" },
        { id: "isolated", type: "task", parentId: "root" },
      ],
      [
        { from: "connected", to: "root", relationType: "depends_on" },
      ],
    );
    const report = analyzeCoupling(doc);
    expect(report.isolatedNodes).toContain("isolated");
    expect(report.isolatedNodes).not.toContain("root");
    expect(report.isolatedNodes).not.toContain("connected");
  });

  it("should calculate depth via parentId chain", () => {
    const doc = makeDoc([
      { id: "root", type: "epic" },
      { id: "child", type: "requirement", parentId: "root" },
      { id: "grandchild", type: "task", parentId: "child" },
    ]);
    const report = analyzeCoupling(doc);
    expect(report.nodes.find((n) => n.nodeId === "root")!.depth).toBe(0);
    expect(report.nodes.find((n) => n.nodeId === "child")!.depth).toBe(1);
    expect(report.nodes.find((n) => n.nodeId === "grandchild")!.depth).toBe(2);
  });

  it("should calculate averages correctly", () => {
    const doc = makeDoc(
      [
        { id: "a" },
        { id: "b" },
      ],
      [
        { from: "a", to: "b", relationType: "depends_on" },
      ],
    );
    const report = analyzeCoupling(doc);
    // a: fanIn=0, fanOut=1; b: fanIn=1, fanOut=0
    expect(report.avgFanIn).toBeCloseTo(0.5);
    expect(report.avgFanOut).toBeCloseTo(0.5);
  });

  it("should handle instability as 0 when no edges", () => {
    const doc = makeDoc([{ id: "lonely" }]);
    const report = analyzeCoupling(doc);
    expect(report.nodes[0].instability).toBe(0);
  });
});
