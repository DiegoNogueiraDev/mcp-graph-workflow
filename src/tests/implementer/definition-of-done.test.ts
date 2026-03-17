import { describe, it, expect } from "vitest";
import { checkDefinitionOfDone } from "../../core/implementer/definition-of-done.js";
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

describe("checkDefinitionOfDone", () => {
  // ── Required checks ──

  it("should fail has_acceptance_criteria when task has no AC", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress" },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_acceptance_criteria")!.passed).toBe(false);
    expect(report.ready).toBe(false);
  });

  it("should pass has_acceptance_criteria when task has AC", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["Should return 200"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_acceptance_criteria")!.passed).toBe(true);
  });

  it("should pass has_acceptance_criteria when parent has AC", () => {
    const doc = makeDoc([
      { id: "epic1", type: "epic", status: "backlog", acceptanceCriteria: ["Epic AC"] },
      { id: "t1", type: "task", status: "in_progress", parentId: "epic1" },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_acceptance_criteria")!.passed).toBe(true);
  });

  it("should fail no_unresolved_blockers when depends_on non-done node", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"] },
        { id: "t2", type: "task", status: "backlog" },
      ],
      [{ from: "t1", to: "t2", relationType: "depends_on" }],
    );
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "no_unresolved_blockers")!.passed).toBe(false);
  });

  it("should pass no_unresolved_blockers when all blockers are done", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"] },
        { id: "t2", type: "task", status: "done" },
      ],
      [{ from: "t1", to: "t2", relationType: "depends_on" }],
    );
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "no_unresolved_blockers")!.passed).toBe(true);
  });

  it("should fail status_flow_valid when node is in backlog", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "backlog", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "status_flow_valid")!.passed).toBe(false);
  });

  it("should pass status_flow_valid when node is in_progress or done", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "status_flow_valid")!.passed).toBe(true);
  });

  it("should check ac_quality_pass using AC quality score", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task", status: "in_progress",
        acceptanceCriteria: ["Given a user, When they login, Then should redirect to dashboard"],
      },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    const acCheck = report.checks.find((c) => c.name === "ac_quality_pass");
    expect(acCheck).toBeDefined();
    expect(acCheck!.severity).toBe("required");
  });

  // ── Recommended checks ──

  it("should fail has_description when task has no description", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_description")!.passed).toBe(false);
    expect(report.checks.find((c) => c.name === "has_description")!.severity).toBe("recommended");
  });

  it("should pass has_description when task has description", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", description: "A description", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_description")!.passed).toBe(true);
  });

  it("should fail not_oversized when L task has no children", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", xpSize: "L", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "not_oversized")!.passed).toBe(false);
    expect(report.checks.find((c) => c.name === "not_oversized")!.severity).toBe("recommended");
  });

  it("should pass not_oversized when M task has no children", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", xpSize: "M", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "not_oversized")!.passed).toBe(true);
  });

  it("should pass not_oversized when L task has children", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", xpSize: "L", acceptanceCriteria: ["AC"] },
      { id: "st1", type: "subtask", status: "done", parentId: "t1" },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "not_oversized")!.passed).toBe(true);
  });

  it("should fail has_testable_ac when no AC is testable", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["Make it better"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_testable_ac")!.passed).toBe(false);
  });

  it("should pass has_testable_ac when at least 1 AC is testable", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["Should return status 200"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_testable_ac")!.passed).toBe(true);
  });

  it("should fail has_estimate when no size or estimate", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"], xpSize: undefined },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_estimate")!.passed).toBe(false);
  });

  it("should pass has_estimate when xpSize is set", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"], xpSize: "S" },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_estimate")!.passed).toBe(true);
  });

  it("should pass has_estimate when estimateMinutes is set", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"], estimateMinutes: 60 },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.find((c) => c.name === "has_estimate")!.passed).toBe(true);
  });

  // ── Scoring ──

  it("should be ready when all required checks pass", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task", status: "in_progress", xpSize: "S",
        description: "A task",
        acceptanceCriteria: ["Given valid input, When submitted, Then should save and return 200"],
      },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.ready).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(50);
  });

  it("should return grade based on score", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task", status: "in_progress", xpSize: "M",
        description: "Full task",
        acceptanceCriteria: ["Given valid input, When submitted, Then should save successfully"],
      },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
  });

  it("should return report with correct nodeId and title", () => {
    const doc = makeDoc([
      { id: "my-task", type: "task", title: "My Task", status: "in_progress", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "my-task");
    expect(report.nodeId).toBe("my-task");
    expect(report.title).toBe("My Task");
  });

  it("should have 8 checks total", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks).toHaveLength(8);
  });

  it("should have 4 required and 4 recommended checks", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["AC"] },
    ]);
    const report = checkDefinitionOfDone(doc, "t1");
    expect(report.checks.filter((c) => c.severity === "required")).toHaveLength(4);
    expect(report.checks.filter((c) => c.severity === "recommended")).toHaveLength(4);
  });

  it("should handle non-existent nodeId gracefully", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress" },
    ]);
    const report = checkDefinitionOfDone(doc, "unknown");
    expect(report.ready).toBe(false);
    expect(report.nodeId).toBe("unknown");
  });
});
