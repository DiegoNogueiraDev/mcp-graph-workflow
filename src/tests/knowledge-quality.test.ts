import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import {
  calculateQualityScore,
  decayStaleKnowledge,
  recordUsage,
  getSourceReliabilityWeight,
} from "../core/rag/knowledge-quality.js";
import type { KnowledgeDocument } from "../schemas/knowledge.schema.js";

function makeDoc(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: "kdoc_test1",
    sourceType: "memory",
    sourceId: "test:1",
    title: "Test doc",
    content: "Some content for testing quality scoring",
    contentHash: "abc123",
    chunkIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    qualityScore: 0.5,
    usageCount: 0,
    ...overrides,
  };
}

describe("Knowledge Quality Engine", () => {
  describe("calculateQualityScore", () => {
    it("should return a score between 0 and 1", () => {
      const doc = makeDoc();
      const score = calculateQualityScore(doc);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should give higher scores to recent docs", () => {
      const recent = makeDoc({ createdAt: new Date().toISOString() });
      const old = makeDoc({
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
      expect(calculateQualityScore(recent)).toBeGreaterThan(calculateQualityScore(old));
    });

    it("should give higher scores to docs with more usage", () => {
      const used = makeDoc({ usageCount: 20 });
      const unused = makeDoc({ usageCount: 0 });
      expect(calculateQualityScore(used)).toBeGreaterThan(calculateQualityScore(unused));
    });

    it("should give higher scores to more reliable source types", () => {
      const docs = makeDoc({ sourceType: "docs" });
      const webCapture = makeDoc({ sourceType: "web_capture" });
      expect(calculateQualityScore(docs)).toBeGreaterThan(calculateQualityScore(webCapture));
    });

    it("should give higher scores to longer content", () => {
      const long = makeDoc({ content: "x".repeat(2000) });
      const short = makeDoc({ content: "short" });
      expect(calculateQualityScore(long)).toBeGreaterThan(calculateQualityScore(short));
    });
  });

  describe("getSourceReliabilityWeight", () => {
    it("should return known weights for common source types", () => {
      expect(getSourceReliabilityWeight("docs")).toBe(0.9);
      expect(getSourceReliabilityWeight("memory")).toBe(0.8);
      expect(getSourceReliabilityWeight("prd")).toBe(0.85);
      expect(getSourceReliabilityWeight("web_capture")).toBe(0.7);
      expect(getSourceReliabilityWeight("ai_decision")).toBe(0.6);
    });

    it("should return default weight for unknown types", () => {
      expect(getSourceReliabilityWeight("upload")).toBe(0.5);
    });
  });

  describe("recordUsage", () => {
    let db: Database.Database;
    let knowledgeStore: KnowledgeStore;

    beforeEach(() => {
      db = new Database(":memory:");
      configureDb(db);
      runMigrations(db);
      knowledgeStore = new KnowledgeStore(db);
    });

    it("should insert a usage log entry", () => {
      const doc = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "test:usage",
        title: "Usage test",
        content: "Testing usage recording",
      });

      recordUsage(db, doc.id, "how to auth", "retrieved", { tool: "rag_context" });

      const logs = db
        .prepare("SELECT * FROM knowledge_usage_log WHERE doc_id = ?")
        .all(doc.id) as Array<{ doc_id: string; action: string; query: string }>;
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("retrieved");
      expect(logs[0].query).toBe("how to auth");
    });

    it("should increment usage_count on the document", () => {
      const doc = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "test:usage2",
        title: "Usage test 2",
        content: "Testing usage increment",
      });

      recordUsage(db, doc.id, "query1", "retrieved");
      recordUsage(db, doc.id, "query2", "helpful");

      const row = db
        .prepare("SELECT usage_count FROM knowledge_documents WHERE id = ?")
        .get(doc.id) as { usage_count: number };
      expect(row.usage_count).toBe(2);
    });

    it("should update last_accessed_at", () => {
      const doc = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "test:access",
        title: "Access test",
        content: "Testing access timestamp",
      });

      recordUsage(db, doc.id, "query", "retrieved");

      const row = db
        .prepare("SELECT last_accessed_at FROM knowledge_documents WHERE id = ?")
        .get(doc.id) as { last_accessed_at: string };
      expect(row.last_accessed_at).toBeTruthy();
    });
  });

  describe("decayStaleKnowledge", () => {
    let db: Database.Database;
    let knowledgeStore: KnowledgeStore;

    beforeEach(() => {
      db = new Database(":memory:");
      configureDb(db);
      runMigrations(db);
      knowledgeStore = new KnowledgeStore(db);
    });

    it("should update staleness_days based on created_at", () => {
      // Insert a doc with old created_at
      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO knowledge_documents
          (id, source_type, source_id, title, content, content_hash, chunk_index, created_at, updated_at, quality_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("kdoc_old", "memory", "old:1", "Old doc", "Old content", "hash1", 0, oldDate, oldDate, 0.5);

      const result = decayStaleKnowledge(db);
      expect(result.updated).toBeGreaterThan(0);

      const row = db
        .prepare("SELECT staleness_days, quality_score FROM knowledge_documents WHERE id = ?")
        .get("kdoc_old") as { staleness_days: number; quality_score: number };
      expect(row.staleness_days).toBeGreaterThanOrEqual(14);
    });

    it("should recalculate quality_score for all docs", () => {
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "decay:1",
        title: "Fresh doc",
        content: "Recently created documentation content for testing quality",
      });

      const result = decayStaleKnowledge(db);
      expect(result.updated).toBeGreaterThan(0);

      const row = db
        .prepare("SELECT quality_score FROM knowledge_documents WHERE source_id = ?")
        .get("decay:1") as { quality_score: number };
      // Quality score should be recalculated (not the default 0.5)
      expect(row.quality_score).toBeGreaterThan(0);
      expect(row.quality_score).toBeLessThanOrEqual(1);
    });
  });
});
