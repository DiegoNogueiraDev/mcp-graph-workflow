import { describe, it, expect } from "vitest";
import { checkHandoffReadiness } from "../../core/handoff/delivery-checklist.js";
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

describe("checkHandoffReadiness", () => {
  // ── Required checks ──

  it("should fail when not all tasks done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "in_progress" },
    ]);
    const report = checkHandoffReadiness(doc);
    expect(report.ready).toBe(false);
    const check = report.checks.find((c) => c.name === "all_tasks_done");
    expect(check?.passed).toBe(false);
  });

  it("should pass all_tasks_done when 100% done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkHandoffReadiness(doc);
    const check = report.checks.find((c) => c.name === "all_tasks_done");
    expect(check?.passed).toBe(true);
  });

  it("should check ac_coverage at 80% threshold", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done" },
      { type: "task", status: "done" },
      { type: "task", status: "done" },
      { type: "task", status: "done" },
    ]);
    const report = checkHandoffReadiness(doc);
    const check = report.checks.find((c) => c.name === "ac_coverage");
    expect(check?.passed).toBe(false);
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
    const report = checkHandoffReadiness(doc);
    const check = report.checks.find((c) => c.name === "no_cycles");
    expect(check?.passed).toBe(false);
  });

  // ── Recommended checks ──

  it("should pass knowledge_captured when knowledgeCount > 0", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkHandoffReadiness(doc, { knowledgeCount: 5 });
    const check = report.checks.find((c) => c.name === "knowledge_captured");
    expect(check?.passed).toBe(true);
  });

  it("should fail knowledge_captured when no knowledge", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkHandoffReadiness(doc);
    const check = report.checks.find((c) => c.name === "knowledge_captured");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("recommended");
  });

  it("should check milestones_done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "milestone", status: "done" },
    ]);
    const report = checkHandoffReadiness(doc);
    const check = report.checks.find((c) => c.name === "milestones_done");
    expect(check?.passed).toBe(true);
  });

  it("should check doc_completeness", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"], description: "desc" },
    ]);
    const report = checkHandoffReadiness(doc);
    const check = report.checks.find((c) => c.name === "doc_completeness");
    expect(check?.severity).toBe("recommended");
  });

  // ── Composite behavior ──

  it("should have exactly 10 checks", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkHandoffReadiness(doc);
    expect(report.checks).toHaveLength(10);
  });

  it("should have 5 required and 5 recommended", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const report = checkHandoffReadiness(doc);
    expect(report.checks.filter((c) => c.severity === "required")).toHaveLength(5);
    expect(report.checks.filter((c) => c.severity === "recommended")).toHaveLength(5);
  });
});
