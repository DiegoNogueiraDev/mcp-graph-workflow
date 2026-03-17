import { describe, it, expect } from "vitest";
import { checkListeningReadiness } from "../../core/listener/feedback-readiness.js";
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

describe("checkListeningReadiness", () => {
  // ── Required checks ──

  it("should fail when not all tasks done", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "in_progress" },
    ]);
    const report = checkListeningReadiness(doc);
    expect(report.ready).toBe(false);
  });

  it("should fail when in_progress tasks exist", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "in_progress" },
    ]);
    const report = checkListeningReadiness(doc);
    const check = report.checks.find((c) => c.name === "no_in_progress");
    expect(check?.passed).toBe(false);
  });

  it("should fail when blocked tasks exist", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "blocked" },
    ]);
    const report = checkListeningReadiness(doc);
    const check = report.checks.find((c) => c.name === "no_blocked");
    expect(check?.passed).toBe(false);
  });

  it("should pass all required when all tasks done and no blocked/in_progress", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "done" },
    ]);
    const report = checkListeningReadiness(doc);
    const requiredChecks = report.checks.filter((c) => c.severity === "required");
    expect(requiredChecks.every((c) => c.passed)).toBe(true);
  });

  // ── Recommended checks ──

  it("should check has_snapshot as recommended", () => {
    const doc = makeDoc([{ type: "task", status: "done" }]);
    const report = checkListeningReadiness(doc);
    const check = report.checks.find((c) => c.name === "has_snapshot");
    expect(check?.severity).toBe("recommended");
    expect(check?.passed).toBe(false);
  });

  it("should pass has_snapshot when provided via opts", () => {
    const doc = makeDoc([{ type: "task", status: "done" }]);
    const report = checkListeningReadiness(doc, { hasSnapshots: true });
    const check = report.checks.find((c) => c.name === "has_snapshot");
    expect(check?.passed).toBe(true);
  });

  it("should pass knowledge_indexed when provided via opts", () => {
    const doc = makeDoc([{ type: "task", status: "done" }]);
    const report = checkListeningReadiness(doc, { knowledgeCount: 3 });
    const check = report.checks.find((c) => c.name === "knowledge_indexed");
    expect(check?.passed).toBe(true);
  });

  // ── Composite behavior ──

  it("should have exactly 8 checks", () => {
    const doc = makeDoc([{ type: "task", status: "done" }]);
    const report = checkListeningReadiness(doc);
    expect(report.checks).toHaveLength(8);
  });

  it("should have 3 required and 5 recommended checks", () => {
    const doc = makeDoc([{ type: "task", status: "done" }]);
    const report = checkListeningReadiness(doc);
    expect(report.checks.filter((c) => c.severity === "required")).toHaveLength(3);
    expect(report.checks.filter((c) => c.severity === "recommended")).toHaveLength(5);
  });

  it("should calculate score and grade", () => {
    const doc = makeDoc([{ type: "task", status: "done" }]);
    const report = checkListeningReadiness(doc);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
  });

  it("should include summary", () => {
    const doc = makeDoc([{ type: "task", status: "done" }]);
    const report = checkListeningReadiness(doc);
    expect(report.summary.length).toBeGreaterThan(0);
  });
});
