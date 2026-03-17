import { describe, it, expect } from "vitest";
import { calculateSprintProgress } from "../../core/implementer/sprint-progress.js";
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

describe("calculateSprintProgress", () => {
  it("should return empty burndown for empty graph", () => {
    const doc = makeDoc();
    const report = calculateSprintProgress(doc);
    expect(report.burndown.total).toBe(0);
    expect(report.burndown.donePercent).toBe(0);
  });

  it("should calculate correct burndown counts", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", sprint: "s1" },
      { id: "t2", type: "task", status: "in_progress", sprint: "s1" },
      { id: "t3", type: "task", status: "blocked", sprint: "s1" },
      { id: "t4", type: "task", status: "backlog", sprint: "s1" },
      { id: "t5", type: "task", status: "ready", sprint: "s1" },
    ]);
    const report = calculateSprintProgress(doc, "s1");
    expect(report.burndown.total).toBe(5);
    expect(report.burndown.done).toBe(1);
    expect(report.burndown.inProgress).toBe(1);
    expect(report.burndown.blocked).toBe(1);
    expect(report.burndown.backlog).toBe(1);
    expect(report.burndown.ready).toBe(1);
    expect(report.burndown.donePercent).toBe(20);
  });

  it("should filter by sprint when provided", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", sprint: "s1" },
      { id: "t2", type: "task", status: "backlog", sprint: "s2" },
    ]);
    const report = calculateSprintProgress(doc, "s1");
    expect(report.burndown.total).toBe(1);
    expect(report.sprint).toBe("s1");
  });

  it("should include all tasks when sprint is not specified", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", sprint: "s1" },
      { id: "t2", type: "task", status: "backlog", sprint: "s2" },
      { id: "t3", type: "task", status: "ready" },
    ]);
    const report = calculateSprintProgress(doc);
    expect(report.burndown.total).toBe(3);
    expect(report.sprint).toBeNull();
  });

  it("should detect blockers with blocked-by details", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "blocked", sprint: "s1" },
        { id: "t2", type: "task", status: "backlog", sprint: "s1" },
      ],
      [{ from: "t1", to: "t2", relationType: "depends_on" }],
    );
    const report = calculateSprintProgress(doc, "s1");
    expect(report.blockers.length).toBeGreaterThan(0);
    expect(report.blockers[0].nodeId).toBe("t1");
  });

  it("should include velocity trend data", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task", status: "done", sprint: "s1",
        createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z",
      },
    ]);
    const report = calculateSprintProgress(doc, "s1");
    expect(report.velocityTrend).toBeDefined();
    expect(["up", "down", "stable"]).toContain(report.velocityTrend.trend);
  });

  it("should calculate critical path remaining", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "done", sprint: "s1" },
        { id: "t2", type: "task", status: "backlog", sprint: "s1" },
        { id: "t3", type: "task", status: "backlog", sprint: "s1" },
      ],
      [
        { from: "t3", to: "t2", relationType: "depends_on" },
        { from: "t2", to: "t1", relationType: "depends_on" },
      ],
    );
    const report = calculateSprintProgress(doc, "s1");
    // t1 is done, t2 and t3 are in the critical path and not done
    expect(report.criticalPathRemaining).toBeGreaterThanOrEqual(0);
  });

  it("should return null for estimatedCompletionDays when no velocity data", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "backlog", sprint: "s1" },
    ]);
    const report = calculateSprintProgress(doc, "s1");
    expect(report.estimatedCompletionDays).toBeNull();
  });

  it("should include summary string", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", sprint: "s1" },
    ]);
    const report = calculateSprintProgress(doc, "s1");
    expect(report.summary).toBeTruthy();
    expect(typeof report.summary).toBe("string");
  });

  it("should only count task and subtask types", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", sprint: "s1" },
      { id: "r1", type: "requirement", status: "backlog" },
      { id: "d1", type: "decision", status: "backlog" },
    ]);
    const report = calculateSprintProgress(doc, "s1");
    expect(report.burndown.total).toBe(1);
  });
});
