import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { applyFeedback } from "../core/rag/knowledge-feedback.js";

describe("Knowledge Feedback", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  it("should increase quality_score for helpful feedback", () => {
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "mem:fb1",
      title: "Helpful doc",
      content: "Very useful authentication pattern",
    });

    const initialScore = (db
      .prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { quality_score: number }).quality_score;

    applyFeedback(db, doc.id, "how to auth", "helpful");

    const newScore = (db
      .prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { quality_score: number }).quality_score;

    expect(newScore).toBeGreaterThan(initialScore);
  });

  it("should decrease quality_score for unhelpful feedback", () => {
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "mem:fb2",
      title: "Not helpful doc",
      content: "Outdated pattern that no longer works",
    });

    const initialScore = (db
      .prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { quality_score: number }).quality_score;

    applyFeedback(db, doc.id, "search query", "unhelpful");

    const newScore = (db
      .prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { quality_score: number }).quality_score;

    expect(newScore).toBeLessThan(initialScore);
  });

  it("should mark doc as stale for outdated feedback", () => {
    const doc = store.insert({
      sourceType: "docs",
      sourceId: "docs:fb3",
      title: "Old docs",
      content: "Documentation from old version",
    });

    applyFeedback(db, doc.id, "query", "outdated");

    const row = db
      .prepare("SELECT staleness_days FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { staleness_days: number };

    expect(row.staleness_days).toBe(999);
  });

  it("should record usage in the log", () => {
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "mem:fb4",
      title: "Logged doc",
      content: "Content that gets logged",
    });

    applyFeedback(db, doc.id, "test query", "helpful", { tool: "rag_context" });

    const logs = db
      .prepare("SELECT * FROM knowledge_usage_log WHERE doc_id = ?")
      .all(doc.id) as Array<{ action: string }>;
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("helpful");
  });

  it("should cap quality_score at 1.0", () => {
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "mem:fb5",
      title: "Max quality",
      content: "Content pushed to max quality",
    });

    // Set quality to 0.98 manually
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.98 WHERE id = ?").run(doc.id);

    applyFeedback(db, doc.id, "query", "helpful");

    const score = (db
      .prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { quality_score: number }).quality_score;

    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should floor quality_score at 0.1", () => {
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "mem:fb6",
      title: "Low quality",
      content: "Content pushed to min quality",
    });

    // Set quality to 0.12 manually
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.12 WHERE id = ?").run(doc.id);

    applyFeedback(db, doc.id, "query", "unhelpful");

    const score = (db
      .prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { quality_score: number }).quality_score;

    expect(score).toBeGreaterThanOrEqual(0.1);
  });
});
