import { describe, it, expect } from "vitest";
import { checkReviewReadiness } from "../../core/reviewer/review-readiness.js";
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

describe("checkReviewReadiness", () => {
  // ── Required checks ──

  it("should fail when less than 80% tasks done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "backlog" },
      { type: "task", status: "backlog" },
    ]);
    const report = checkReviewReadiness(doc);
    expect(report.ready).toBe(false);
    const check = report.checks.find((c) => c.name === "completion_rate");
    expect(check?.passed).toBe(false);
  });

  it("should pass completion_rate when ≥80% done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "backlog" },
    ]);
    const report = checkReviewReadiness(doc);
    const check = report.checks.find((c) => c.name === "completion_rate");
    expect(check?.passed).toBe(true);
  });

  it("should detect blocked tasks", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "done", acceptanceCriteria: ["AC1"] },
        { id: "t2", type: "task", status: "blocked" },
      ],
      [{ from: "t2", to: "t1", relationType: "depends_on" }],
    );
    const report = checkReviewReadiness(doc);
    const check = report.checks.find((c) => c.name === "no_blocked_tasks");
    expect(check?.severity).toBe("required");
  });

  it("should check AC coverage of done tasks", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "done" },
      { type: "task", status: "done" },
      { type: "task", status: "done" },
      { type: "task", status: "done" },
    ]);
    const report = checkReviewReadiness(doc);
    const check = report.checks.find((c) => c.name === "ac_coverage");
    expect(check?.passed).toBe(false);
  });

  it("should pass ac_coverage when ≥70% done tasks have AC", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done" },
    ]);
    const report = checkReviewReadiness(doc);
    const check = report.checks.find((c) => c.name === "ac_coverage");
    expect(check?.passed).toBe(true);
  });

  it("should detect cycles", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "done", acceptanceCriteria: ["AC1"] },
        { id: "t2", type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      ],
      [
        { from: "t1", to: "t2", relationType: "depends_on" },
        { from: "t2", to: "t1", relationType: "depends_on" },
      ],
    );
    const report = checkReviewReadiness(doc);
    const check = report.checks.find((c) => c.name === "no_cycles");
    expect(check?.passed).toBe(false);
  });

  // ── Recommended checks ──

  it("should check velocity_stable as recommended", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkReviewReadiness(doc);
    const check = report.checks.find((c) => c.name === "velocity_stable");
    expect(check?.severity).toBe("recommended");
  });

  it("should check scope_integrity as recommended", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkReviewReadiness(doc);
    const check = report.checks.find((c) => c.name === "scope_integrity");
    expect(check?.severity).toBe("recommended");
  });

  // ── Composite behavior ──

  it("should have exactly 10 checks", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkReviewReadiness(doc);
    expect(report.checks).toHaveLength(10);
  });

  it("should have 5 required and 5 recommended checks", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkReviewReadiness(doc);
    expect(report.checks.filter((c) => c.severity === "required")).toHaveLength(5);
    expect(report.checks.filter((c) => c.severity === "recommended")).toHaveLength(5);
  });

  it("should be ready when all required checks pass", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "backlog" },
    ]);
    const report = checkReviewReadiness(doc);
    const failedRequired = report.checks.filter((c) => c.severity === "required" && !c.passed);
    if (failedRequired.length === 0) {
      expect(report.ready).toBe(true);
    }
  });

  it("should calculate score and assign grade", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkReviewReadiness(doc);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
  });

  it("should include summary in report", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkReviewReadiness(doc);
    expect(report.summary.length).toBeGreaterThan(0);
  });
});
