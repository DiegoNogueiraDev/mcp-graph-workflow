import { describe, it, expect } from "vitest";
import { analyzeBacklogHealth } from "../../core/listener/backlog-health.js";
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

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe("analyzeBacklogHealth", () => {
  it("should count backlog and ready tasks", () => {
    const doc = makeDoc([
      { type: "task", status: "backlog" },
      { type: "task", status: "backlog" },
      { type: "task", status: "ready" },
      { type: "task", status: "done" },
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.backlogCount).toBe(2);
    expect(report.readyCount).toBe(1);
  });

  it("should detect stale tasks (>30 days old)", () => {
    const doc = makeDoc([
      { type: "task", status: "backlog", createdAt: daysAgo(45) },
      { type: "task", status: "backlog", createdAt: daysAgo(10) },
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.staleTasks).toHaveLength(1);
    expect(report.staleTasks[0].daysInBacklog).toBeGreaterThanOrEqual(45);
  });

  it("should detect stale ready tasks too", () => {
    const doc = makeDoc([
      { type: "task", status: "ready", createdAt: daysAgo(35) },
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.staleTasks).toHaveLength(1);
  });

  it("should not flag done tasks as stale", () => {
    const doc = makeDoc([
      { type: "task", status: "done", createdAt: daysAgo(60) },
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.staleTasks).toHaveLength(0);
  });

  it("should detect tech debt indicators by title", () => {
    const doc = makeDoc([
      { type: "task", title: "Refactor auth module" },
      { type: "task", title: "Add new feature" },
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.techDebtIndicators).toHaveLength(1);
    expect(report.techDebtIndicators[0].keywords).toContain("refactor");
  });

  it("should detect tech debt by tags", () => {
    const doc = makeDoc([
      { type: "task", title: "Normal task", tags: ["tech-debt"] },
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.techDebtIndicators).toHaveLength(1);
  });

  it("should be clean for new cycle when no stale tasks and limited tech debt", () => {
    const doc = makeDoc([
      { type: "task", status: "backlog", createdAt: daysAgo(5) },
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.cleanForNewCycle).toBe(true);
  });

  it("should not be clean when stale tasks exist", () => {
    const doc = makeDoc([
      { type: "task", status: "backlog", createdAt: daysAgo(45) },
    ]);
    const report = analyzeBacklogHealth(doc);
    expect(report.cleanForNewCycle).toBe(false);
  });
});
