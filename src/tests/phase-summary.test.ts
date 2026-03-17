import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { generateAndIndexPhaseSummary } from "../core/rag/phase-summary.js";
import { makeNode } from "./helpers/factories.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

function buildDoc(store: SqliteStore): GraphDocument {
  return store.toGraphDocument();
}

describe("generateAndIndexPhaseSummary", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Phase Summary Test");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  it("should index a phase summary into knowledge store", () => {
    sqliteStore.insertNode(makeNode({ type: "epic", title: "Auth Epic" }));
    sqliteStore.insertNode(makeNode({ type: "requirement", title: "Login requirement" }));

    const doc = buildDoc(sqliteStore);
    const result = generateAndIndexPhaseSummary(knowledgeStore, doc, "ANALYZE", "DESIGN");

    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Phase ANALYZE completed");
    expect(result.summaryText).toContain("Transitioning to DESIGN");
    expect(knowledgeStore.count("phase_summary")).toBe(1);
  });

  it("should include node counts in summary", () => {
    sqliteStore.insertNode(makeNode({ type: "task", title: "Task 1", status: "done" }));
    sqliteStore.insertNode(makeNode({ type: "task", title: "Task 2", status: "in_progress" }));
    sqliteStore.insertNode(makeNode({ type: "task", title: "Task 3", status: "backlog" }));

    const doc = buildDoc(sqliteStore);
    const result = generateAndIndexPhaseSummary(knowledgeStore, doc, "IMPLEMENT", "VALIDATE");

    expect(result.summaryText).toContain("Tasks: 3 total");
    expect(result.summaryText).toContain("1 done");
    expect(result.summaryText).toContain("1 in progress");
  });

  it("should store phase metadata", () => {
    const doc = buildDoc(sqliteStore);
    generateAndIndexPhaseSummary(knowledgeStore, doc, "DESIGN", "PLAN");

    const docs = knowledgeStore.list({ sourceType: "phase_summary" });
    expect(docs).toHaveLength(1);
    expect(docs[0].metadata).toMatchObject({
      phase: "DESIGN",
      transitionTo: "PLAN",
    });
  });

  it("should include ANALYZE-specific details", () => {
    sqliteStore.insertNode(makeNode({ type: "requirement", title: "Req 1" }));
    sqliteStore.insertNode(makeNode({ type: "requirement", title: "Req 2" }));
    sqliteStore.insertNode(makeNode({ type: "epic", title: "Epic 1" }));

    const doc = buildDoc(sqliteStore);
    const result = generateAndIndexPhaseSummary(knowledgeStore, doc, "ANALYZE", "DESIGN");

    expect(result.summaryText).toContain("Requirements defined: 2");
    expect(result.summaryText).toContain("Epics: 1");
  });

  it("should include DESIGN-specific details", () => {
    sqliteStore.insertNode(makeNode({ type: "decision", title: "Use PostgreSQL" }));
    sqliteStore.insertNode(makeNode({ type: "decision", title: "REST over gRPC" }));
    sqliteStore.insertNode(makeNode({ type: "constraint", title: "Must support offline" }));

    const doc = buildDoc(sqliteStore);
    const result = generateAndIndexPhaseSummary(knowledgeStore, doc, "DESIGN", "PLAN");

    expect(result.summaryText).toContain("Decisions: 2");
    expect(result.summaryText).toContain("Constraints: 1");
    expect(result.summaryText).toContain("Use PostgreSQL");
  });

  it("should be searchable in knowledge store after indexing", () => {
    sqliteStore.insertNode(makeNode({ type: "decision", title: "GraphQL architecture" }));

    const doc = buildDoc(sqliteStore);
    generateAndIndexPhaseSummary(knowledgeStore, doc, "DESIGN", "PLAN");

    const results = knowledgeStore.search("DESIGN");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sourceType).toBe("phase_summary");
  });
});
