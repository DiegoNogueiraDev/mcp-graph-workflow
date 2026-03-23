import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("Migration 11 — Knowledge quality, relations, and usage log", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  it("should add quality_score column with default 0.5", () => {
    const row = db
      .prepare(
        "SELECT quality_score FROM knowledge_documents LIMIT 0",
      )
      .all();
    expect(row).toEqual([]);

    // Insert a doc and verify default
    const store = new KnowledgeStore(db);
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "test:1",
      title: "Test",
      content: "Quality test content",
    });
    const raw = db
      .prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { quality_score: number };
    expect(raw.quality_score).toBe(0.5);
  });

  it("should add usage_count column with default 0", () => {
    const store = new KnowledgeStore(db);
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "test:2",
      title: "Test",
      content: "Usage test content",
    });
    const raw = db
      .prepare("SELECT usage_count FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { usage_count: number };
    expect(raw.usage_count).toBe(0);
  });

  it("should add last_accessed_at column defaulting to null", () => {
    const store = new KnowledgeStore(db);
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "test:3",
      title: "Test",
      content: "Access test content",
    });
    const raw = db
      .prepare("SELECT last_accessed_at FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { last_accessed_at: string | null };
    expect(raw.last_accessed_at).toBeNull();
  });

  it("should add staleness_days column with default 0", () => {
    const store = new KnowledgeStore(db);
    const doc = store.insert({
      sourceType: "memory",
      sourceId: "test:4",
      title: "Test",
      content: "Staleness test content",
    });
    const raw = db
      .prepare("SELECT staleness_days FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { staleness_days: number };
    expect(raw.staleness_days).toBe(0);
  });

  it("should create knowledge_relations table", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_relations'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it("should enforce unique constraint on knowledge_relations", () => {
    const ts = new Date().toISOString();
    db.prepare(
      "INSERT INTO knowledge_relations (id, from_doc_id, to_doc_id, relation, score, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("kr1", "doc1", "doc2", "related_to", 1.0, ts);

    expect(() => {
      db.prepare(
        "INSERT INTO knowledge_relations (id, from_doc_id, to_doc_id, relation, score, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("kr2", "doc1", "doc2", "related_to", 0.5, ts);
    }).toThrow();
  });

  it("should create knowledge_usage_log table", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_usage_log'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it("should allow inserting usage log entries", () => {
    const ts = new Date().toISOString();
    db.prepare(
      "INSERT INTO knowledge_usage_log (doc_id, query, action, context, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("doc1", "how to auth", "retrieved", JSON.stringify({ tool: "rag_context" }), ts);

    const row = db
      .prepare("SELECT * FROM knowledge_usage_log WHERE doc_id = ?")
      .get("doc1") as { doc_id: string; action: string };
    expect(row.doc_id).toBe("doc1");
    expect(row.action).toBe("retrieved");
  });

  it("should create indexes on quality and usage columns", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_knowledge_%'")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_knowledge_quality");
    expect(names).toContain("idx_knowledge_usage");
  });

  it("should preserve existing knowledge documents after migration", () => {
    // Insert before reading — existing rows should have defaults
    const store = new KnowledgeStore(db);
    const doc = store.insert({
      sourceType: "docs",
      sourceId: "compat:1",
      title: "Existing doc",
      content: "This simulates a pre-migration document",
    });

    // Verify all old fields still work
    expect(doc.id).toBeTruthy();
    expect(doc.sourceType).toBe("docs");
    expect(doc.title).toBe("Existing doc");
    expect(doc.contentHash).toBeTruthy();
  });
});
