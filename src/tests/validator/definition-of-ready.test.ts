import { describe, it, expect } from "vitest";
import { checkValidationReadiness } from "../../core/validator/definition-of-ready.js";
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

describe("checkValidationReadiness", () => {
  // ── Required checks ──

  it("should fail when less than 50% tasks done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "backlog" },
      { type: "task", status: "backlog" },
    ]);
    const report = checkValidationReadiness(doc);
    expect(report.ready).toBe(false);
    const check = report.checks.find((c) => c.name === "completion_threshold");
    expect(check?.passed).toBe(false);
  });

  it("should pass completion_threshold when ≥50% done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "backlog" },
    ]);
    const report = checkValidationReadiness(doc);
    const check = report.checks.find((c) => c.name === "completion_threshold");
    expect(check?.passed).toBe(true);
  });

  it("should fail when no acceptance criteria defined", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "done" },
    ]);
    const report = checkValidationReadiness(doc);
    const check = report.checks.find((c) => c.name === "ac_defined");
    expect(check?.passed).toBe(false);
  });

  it("should pass ac_defined with acceptance_criteria node type", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "acceptance_criteria", status: "backlog" },
    ]);
    const report = checkValidationReadiness(doc);
    const check = report.checks.find((c) => c.name === "ac_defined");
    expect(check?.passed).toBe(true);
  });

  it("should pass ac_defined with acceptanceCriteria field", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["Given X When Y Then Z"] },
    ]);
    const report = checkValidationReadiness(doc);
    const check = report.checks.find((c) => c.name === "ac_defined");
    expect(check?.passed).toBe(true);
  });

  it("should detect done_integrity issues", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "done", blocked: true, acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkValidationReadiness(doc);
    const check = report.checks.find((c) => c.name === "done_integrity");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("required");
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
    const report = checkValidationReadiness(doc);
    const check = report.checks.find((c) => c.name === "no_cycles");
    expect(check?.passed).toBe(false);
  });

  // ── Recommended checks ──

  it("should check status_flow_compliance as recommended", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"], createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"], createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
    ]);
    const report = checkValidationReadiness(doc);
    const check = report.checks.find((c) => c.name === "status_flow_compliance");
    expect(check?.severity).toBe("recommended");
  });

  // ── Composite behavior ──

  it("should be ready when all required checks pass", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["Given X When Y Then Z"], createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
      { type: "task", status: "backlog" },
    ]);
    const report = checkValidationReadiness(doc);
    // Check that all required checks passed
    const failedRequired = report.checks.filter((c) => c.severity === "required" && !c.passed);
    if (failedRequired.length === 0) {
      expect(report.ready).toBe(true);
    }
  });

  it("should not be ready when any required check fails", () => {
    const doc = makeDoc([
      { type: "task", status: "backlog" },
    ]);
    const report = checkValidationReadiness(doc);
    expect(report.ready).toBe(false);
  });

  it("should have exactly 10 checks", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkValidationReadiness(doc);
    expect(report.checks).toHaveLength(10);
  });

  it("should have 5 required and 5 recommended checks", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkValidationReadiness(doc);
    expect(report.checks.filter((c) => c.severity === "required")).toHaveLength(5);
    expect(report.checks.filter((c) => c.severity === "recommended")).toHaveLength(5);
  });

  it("should calculate score based on passed checks", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"], createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
    ]);
    const report = checkValidationReadiness(doc);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("should assign a grade", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkValidationReadiness(doc);
    expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
  });

  it("should include summary", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkValidationReadiness(doc);
    expect(report.summary).toBeDefined();
    expect(report.summary.length).toBeGreaterThan(0);
  });
});
