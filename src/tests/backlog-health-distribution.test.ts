import { describe, it, expect } from "vitest";
import { analyzeBacklogHealth } from "../core/listener/backlog-health.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";

function makeNode(overrides: Partial<GraphNode> & { id: string; title: string }): GraphNode {
  return {
    type: "task",
    status: "backlog",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDoc(nodes: GraphNode[]): GraphDocument {
  return {
    version: "1.0",
    project: { id: "test", name: "test", createdAt: "", updatedAt: "" },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("BUG-29: Backlog health distribution data", () => {
  it("should include typeDistribution with correct counts", () => {
    const doc = makeDoc([
      makeNode({ id: "t1", title: "Task 1", type: "task" }),
      makeNode({ id: "t2", title: "Task 2", type: "task" }),
      makeNode({ id: "s1", title: "Subtask 1", type: "subtask" }),
      makeNode({ id: "e1", title: "Epic 1", type: "epic", status: "ready" }),
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.typeDistribution).toBeDefined();
    expect(report.typeDistribution["task"]).toBe(2);
    expect(report.typeDistribution["subtask"]).toBe(1);
  });

  it("should include priorityDistribution with correct counts", () => {
    const doc = makeDoc([
      makeNode({ id: "t1", title: "Task 1", priority: 1 }),
      makeNode({ id: "t2", title: "Task 2", priority: 1 }),
      makeNode({ id: "t3", title: "Task 3", priority: 3 }),
      makeNode({ id: "t4", title: "Task 4", priority: 5, status: "ready" }),
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.priorityDistribution).toBeDefined();
    expect(report.priorityDistribution["1"]).toBe(2);
    expect(report.priorityDistribution["3"]).toBe(1);
    expect(report.priorityDistribution["5"]).toBe(1);
  });

  it("should count only backlog and ready tasks in distribution", () => {
    const doc = makeDoc([
      makeNode({ id: "t1", title: "Done task", type: "task", status: "done" }),
      makeNode({ id: "t2", title: "Backlog task", type: "task", status: "backlog" }),
      makeNode({ id: "t3", title: "Ready task", type: "subtask", status: "ready" }),
    ]);
    const report = analyzeBacklogHealth(doc);
    // Only backlog and ready counted
    expect(report.typeDistribution["task"]).toBe(1);
    expect(report.typeDistribution["subtask"]).toBe(1);
  });
});
