import { describe, it, expect } from "vitest";
import { checkDoneIntegrity } from "../../core/validator/done-integrity-checker.js";
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

describe("checkDoneIntegrity", () => {
  it("should pass when no done tasks exist", () => {
    const doc = makeDoc([{ type: "task", status: "backlog" }]);
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("should pass when done tasks have no issues", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", blocked: false },
    ]);
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("should detect done task that is still blocked", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", blocked: true },
    ]);
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].issueType).toBe("blocked_but_done");
    expect(report.issues[0].nodeId).toBe("t1");
  });

  it("should detect done task with non-done dependency", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "done" },
        { id: "t2", type: "task", status: "in_progress" },
      ],
      [{ from: "t1", to: "t2", relationType: "depends_on" }],
    );
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].issueType).toBe("dependency_not_done");
  });

  it("should pass when dependency is also done", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "done" },
        { id: "t2", type: "task", status: "done" },
      ],
      [{ from: "t1", to: "t2", relationType: "depends_on" }],
    );
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(true);
  });

  it("should detect multiple issues on same task", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "done", blocked: true },
        { id: "t2", type: "task", status: "backlog" },
      ],
      [{ from: "t1", to: "t2", relationType: "depends_on" }],
    );
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(2);
  });

  it("should ignore non-depends_on edges", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "done" },
        { id: "t2", type: "task", status: "backlog" },
      ],
      [{ from: "t1", to: "t2", relationType: "related_to" }],
    );
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(true);
  });

  it("should only check task and subtask types", () => {
    const doc = makeDoc([
      { id: "r1", type: "requirement", status: "done", blocked: true },
    ]);
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(true);
  });

  it("should handle empty graph", () => {
    const doc = makeDoc();
    const report = checkDoneIntegrity(doc);
    expect(report.passed).toBe(true);
    expect(report.issues).toHaveLength(0);
  });
});
