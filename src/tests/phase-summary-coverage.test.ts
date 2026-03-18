import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { generateAndIndexPhaseSummary } from "../core/rag/phase-summary.js";
import type { GraphDocument } from "../core/graph/graph-types.js";
import { makeNode } from "./helpers/factories.js";

function makeDoc(nodes: ReturnType<typeof makeNode>[] = []): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "p1", name: "Test", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
    nodes,
    edges: [],
    indexes: { byType: {}, byStatus: {}, byParent: {} },
    meta: { createdAt: "2025-01-01", updatedAt: "2025-01-01", nodeCount: nodes.length, edgeCount: 0 },
  };
}

describe("generateAndIndexPhaseSummary", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should generate summary for ANALYZE → DESIGN transition", () => {
    const doc = makeDoc([
      makeNode({ type: "requirement", title: "Req 1" }),
      makeNode({ type: "epic", title: "Epic 1" }),
      makeNode({ type: "task", title: "Task 1" }),
    ]);
    const result = generateAndIndexPhaseSummary(ks, doc, "ANALYZE", "DESIGN");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Phase ANALYZE completed");
    expect(result.summaryText).toContain("Requirements defined: 1");
    expect(result.summaryText).toContain("Epics: 1");
  });

  it("should generate summary for DESIGN → PLAN transition with decisions", () => {
    const doc = makeDoc([
      makeNode({ type: "decision", title: "Use React" }),
      makeNode({ type: "constraint", title: "Budget limit" }),
      makeNode({ type: "risk", title: "Timeline risk" }),
    ]);
    const result = generateAndIndexPhaseSummary(ks, doc, "DESIGN", "PLAN");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Decisions: 1");
    expect(result.summaryText).toContain("Constraints: 1");
    expect(result.summaryText).toContain("Risks: 1");
    expect(result.summaryText).toContain("Key decisions: Use React");
  });

  it("should generate summary for PLAN → IMPLEMENT transition", () => {
    const doc = makeDoc([
      makeNode({ type: "task", title: "Task 1", sprint: "sprint-1" }),
      makeNode({ type: "task", title: "Task 2", sprint: "sprint-1" }),
      makeNode({ type: "task", title: "Task 3" }),
    ]);
    const result = generateAndIndexPhaseSummary(ks, doc, "PLAN", "IMPLEMENT");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Sprint-assigned tasks: 2");
  });

  it("should generate summary for IMPLEMENT → VALIDATE transition", () => {
    const doc = makeDoc([
      makeNode({ type: "task", title: "Task 1", status: "done" }),
      makeNode({ type: "task", title: "Task 2", status: "in_progress" }),
      makeNode({ type: "acceptance_criteria", title: "AC 1" }),
    ]);
    const result = generateAndIndexPhaseSummary(ks, doc, "IMPLEMENT", "VALIDATE");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Tasks completed: 1/2");
    expect(result.summaryText).toContain("Acceptance criteria nodes: 1");
  });

  it("should generate summary for VALIDATE → REVIEW transition", () => {
    const doc = makeDoc([
      makeNode({ type: "task", title: "T1", acceptanceCriteria: ["AC1"] }),
      makeNode({ type: "task", title: "T2" }),
    ]);
    const result = generateAndIndexPhaseSummary(ks, doc, "VALIDATE", "REVIEW");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Tasks with acceptance criteria: 1/2");
  });

  it("should generate summary for REVIEW → HANDOFF transition", () => {
    const doc = makeDoc([
      makeNode({ type: "task", title: "T1", status: "done" }),
      makeNode({ type: "task", title: "T2", status: "done" }),
    ]);
    const result = generateAndIndexPhaseSummary(ks, doc, "REVIEW", "HANDOFF");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("All tasks done: yes");
  });

  it("should generate summary for HANDOFF → LISTENING transition", () => {
    const doc = makeDoc([
      makeNode({ type: "task", title: "T1", status: "done" }),
    ]);
    const result = generateAndIndexPhaseSummary(ks, doc, "HANDOFF", "LISTENING");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Handoff completed. 1 tasks delivered");
  });

  it("should generate summary for LISTENING → ANALYZE transition", () => {
    const doc = makeDoc([
      makeNode({ type: "requirement", title: "New req" }),
      makeNode({ type: "risk", title: "New risk" }),
    ]);
    const result = generateAndIndexPhaseSummary(ks, doc, "LISTENING", "ANALYZE");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Feedback items collected: 2");
  });

  it("should handle empty graph", () => {
    const doc = makeDoc();
    const result = generateAndIndexPhaseSummary(ks, doc, "ANALYZE", "DESIGN");
    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Total nodes: 0");
  });

  it("should store document in knowledge store", () => {
    const doc = makeDoc([makeNode()]);
    generateAndIndexPhaseSummary(ks, doc, "ANALYZE", "DESIGN");
    const count = ks.count("phase_summary");
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
