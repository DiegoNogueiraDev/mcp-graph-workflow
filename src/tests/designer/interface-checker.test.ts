import { describe, it, expect } from "vitest";
import { checkInterfaces } from "../../core/designer/interface-checker.js";
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

describe("checkInterfaces", () => {
  it("should return empty report when no interface-type nodes exist", () => {
    const doc = makeDoc([{ type: "task" }, { type: "subtask" }]);
    const report = checkInterfaces(doc);
    expect(report.results).toHaveLength(0);
    expect(report.overallScore).toBe(100);
    expect(report.nodesWithoutContracts).toHaveLength(0);
  });

  it("should score 100 for a node with description, AC, edges, and constraint link", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement", description: "A requirement", acceptanceCriteria: ["criterion"] },
        { id: "con1", type: "constraint" },
      ],
      [
        { from: "req1", to: "con1", relationType: "related_to" },
      ],
    );
    const report = checkInterfaces(doc);
    const result = report.results.find((r) => r.nodeId === "req1");
    expect(result!.score).toBe(100);
    expect(result!.hasDescription).toBe(true);
    expect(result!.hasAC).toBe(true);
    expect(result!.hasEdges).toBe(true);
    expect(result!.hasConstraintLink).toBe(true);
  });

  it("should score 0 for a node with no description, no AC, no edges, no constraint", () => {
    const doc = makeDoc([{ id: "req1", type: "requirement" }]);
    const report = checkInterfaces(doc);
    expect(report.results[0].score).toBe(0);
    expect(report.nodesWithoutContracts).toContain("req1");
  });

  it("should give 25 points per attribute", () => {
    // Only description
    const doc = makeDoc([{ id: "req1", type: "requirement", description: "Has desc" }]);
    const report = checkInterfaces(doc);
    expect(report.results[0].score).toBe(25);
  });

  it("should identify nodes below 50 as 'without contracts'", () => {
    const doc = makeDoc([
      { id: "req1", type: "requirement", description: "Has desc" }, // 25
      { id: "req2", type: "requirement", description: "Also desc", acceptanceCriteria: ["ac"] }, // 50
    ]);
    const report = checkInterfaces(doc);
    expect(report.nodesWithoutContracts).toContain("req1");
    expect(report.nodesWithoutContracts).not.toContain("req2");
  });

  it("should calculate overall score as average", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement", description: "desc", acceptanceCriteria: ["ac"] },
        { id: "req2", type: "requirement" },
      ],
    );
    const report = checkInterfaces(doc);
    // req1: desc(25)+ac(25) = 50, req2: 0 → avg = 25
    expect(report.overallScore).toBe(25);
  });

  it("should only evaluate epic, requirement, and decision nodes", () => {
    const doc = makeDoc([
      { id: "task1", type: "task", description: "task desc" },
      { id: "req1", type: "requirement" },
      { id: "epic1", type: "epic", description: "epic desc" },
      { id: "dec1", type: "decision", description: "dec desc" },
    ]);
    const report = checkInterfaces(doc);
    expect(report.results).toHaveLength(3); // req1, epic1, dec1
    expect(report.results.map((r) => r.nodeId).sort()).toEqual(["dec1", "epic1", "req1"]);
  });

  it("should detect constraint link via any edge to a constraint node", () => {
    const doc = makeDoc(
      [
        { id: "epic1", type: "epic", description: "desc" },
        { id: "con1", type: "constraint" },
      ],
      [
        { from: "con1", to: "epic1", relationType: "related_to" },
      ],
    );
    const report = checkInterfaces(doc);
    expect(report.results[0].hasConstraintLink).toBe(true);
  });
});
