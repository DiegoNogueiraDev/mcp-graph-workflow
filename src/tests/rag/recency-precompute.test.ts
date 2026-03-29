/**
 * TDD tests for pre-computed recency scores.
 * Task 4.2: Calculate recency scores at insert/update, store in DB column.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../../core/store/migrations.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";

describe("Pre-computed recency scores", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should have recency_score column in knowledge_documents table", () => {
    const columns = db
      .prepare("PRAGMA table_info(knowledge_documents)")
      .all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("recency_score");
  });

  it("should set recency_score on insert", () => {
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "test-1",
      title: "Test Doc",
      content: "Test content for recency",
    });

    const row = db
      .prepare("SELECT recency_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { recency_score: number } | undefined;

    expect(row).toBeDefined();
    // Just inserted = very recent = score close to 1.0
    expect(row!.recency_score).toBeGreaterThan(0.9);
    expect(row!.recency_score).toBeLessThanOrEqual(1.0);
  });

  it("should calculate recency_score using exponential decay formula", () => {
    // Insert a document then manually backdate its created_at to 30 days ago
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "test-old",
      title: "Old Doc",
      content: "Old content for recency test",
    });

    // Backdate to 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE knowledge_documents SET created_at = ? WHERE id = ?")
      .run(thirtyDaysAgo, doc.id);

    // Recalculate
    const updated = store.batchUpdateRecencyScores();
    expect(updated).toBeGreaterThanOrEqual(1);

    const row = db
      .prepare("SELECT recency_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { recency_score: number };

    // 30-day half-life: pow(0.5, 30/30) = 0.5
    expect(row.recency_score).toBeCloseTo(0.5, 1);
  });

  it("should batch update all recency scores", () => {
    store.insert({ sourceType: "memory", sourceId: "a", title: "A", content: "Content A" });
    store.insert({ sourceType: "memory", sourceId: "b", title: "B", content: "Content B" });
    store.insert({ sourceType: "docs", sourceId: "c", title: "C", content: "Content C" });

    const updated = store.batchUpdateRecencyScores();
    expect(updated).toBe(3);

    // All should have scores close to 1.0 (just inserted)
    const rows = db
      .prepare("SELECT recency_score FROM knowledge_documents")
      .all() as Array<{ recency_score: number }>;

    for (const row of rows) {
      expect(row.recency_score).toBeGreaterThan(0.9);
    }
  });

  it("should have index on recency_score column", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'knowledge_documents'")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_knowledge_recency");
  });
});
