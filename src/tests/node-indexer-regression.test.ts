/**
 * Regression tests for node-indexer + schema validation.
 * Ensures existing knowledge flows are not broken by "graph_node" source type
 * and verifies SQLite-level data integrity.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore, contentHash } from "../core/store/knowledge-store.js";
import { EntityStore } from "../core/rag/entity-store.js";
import { indexEntitiesForDoc } from "../core/rag/entity-index-hook.js";
import { makeNode } from "./helpers/factories.js";
import { indexNodeAsKnowledge } from "../core/rag/node-indexer.js";
import { KnowledgeSourceTypeSchema } from "../schemas/knowledge.schema.js";

let store: SqliteStore;
let ks: KnowledgeStore;

beforeEach(() => {
  store = SqliteStore.open(":memory:");
  store.initProject("Regression Test");
  ks = new KnowledgeStore(store.getDb());
});

afterEach(() => {
  store.close();
});

// ── Existing flows still work ────────────────────────────

describe("existing knowledge flows", () => {
  it("should still index and search memory source type", () => {
    // Arrange
    ks.insert({
      sourceType: "memory",
      sourceId: "mem-1",
      title: "Arch Decision",
      content: "We use SQLite for storage",
      chunkIndex: 0,
    });

    // Act
    const results = ks.search("SQLite storage", 10);

    // Assert
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].sourceType).toBe("memory");
  });

  it("should still index and search docs source type", () => {
    // Arrange
    ks.insert({
      sourceType: "docs",
      sourceId: "doc-1",
      title: "API Reference",
      content: "Express Router handles HTTP requests and middleware",
      chunkIndex: 0,
    });

    // Act
    const results = ks.search("Express Router", 10);

    // Assert
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].sourceType).toBe("docs");
  });

  it("should still index and search prd source type", () => {
    // Arrange
    ks.insert({
      sourceType: "prd",
      sourceId: "prd-1",
      title: "Product Requirements",
      content: "The system shall support offline graph persistence",
      chunkIndex: 0,
    });

    // Act
    const results = ks.search("offline graph persistence", 10);

    // Assert
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].sourceType).toBe("prd");
  });

  it("should still extract entities for non-graph_node sources", () => {
    // Arrange
    const doc = ks.insert({
      sourceType: "memory",
      sourceId: "mem-entity-1",
      title: "Store Architecture",
      content: "SqliteStore is the core data layer that manages all persistence",
      chunkIndex: 0,
    });
    const es = new EntityStore(store.getDb());

    // Guard: only assert if KG tables exist
    if (!es.hasKgTables()) return;

    // Act
    indexEntitiesForDoc(store.getDb(), doc.id);

    // Assert
    const entities = es.findByName("SqliteStore");
    expect(entities.length).toBeGreaterThan(0);
  });
});

// ── Schema validation ────────────────────────────────────

describe("KnowledgeSourceTypeSchema validation", () => {
  it("should validate graph_node as a valid source type", () => {
    // Act & Assert
    expect(() => KnowledgeSourceTypeSchema.parse("graph_node")).not.toThrow();
  });

  it.each([
    "upload",
    "serena",
    "memory",
    "code_context",
    "docs",
    "web_capture",
    "prd",
    "design",
    "sprint_plan",
    "phase_summary",
    "skill",
    "journey",
    "siebel_sif",
    "siebel_composer",
    "siebel_generated",
    "siebel_docs",
    "swagger",
    "ai_decision",
    "validation_result",
    "test_outcome",
    "synthesis",
    "benchmark",
    "graph_node",
  ])("should validate source type '%s'", (sourceType) => {
    // Act & Assert
    expect(() => KnowledgeSourceTypeSchema.parse(sourceType)).not.toThrow();
  });

  it("should filter knowledge documents by graph_node source type", () => {
    // Arrange
    ks.insert({
      sourceType: "graph_node",
      sourceId: "node-a",
      title: "Task Alpha",
      content: "Implement feature alpha",
      chunkIndex: 0,
    });
    ks.insert({
      sourceType: "graph_node",
      sourceId: "node-b",
      title: "Task Beta",
      content: "Implement feature beta",
      chunkIndex: 0,
    });
    ks.insert({
      sourceType: "memory",
      sourceId: "mem-filter-1",
      title: "Some Memory",
      content: "Memory content for filtering test",
      chunkIndex: 0,
    });

    // Act
    const graphNodeDocs = ks.list({ sourceType: "graph_node" });
    const memoryDocs = ks.list({ sourceType: "memory" });

    // Assert
    expect(graphNodeDocs).toHaveLength(2);
    expect(memoryDocs).toHaveLength(1);
  });
});

// ── SQLite-level verification ────────────────────────────

describe("SQLite-level data integrity", () => {
  it("should have correct source_type in SQLite row after indexing", () => {
    // Arrange
    const node = makeNode({ title: "Verify Source Type" });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const row = store
      .getDb()
      .prepare("SELECT source_type FROM knowledge_documents WHERE source_id = ?")
      .get(node.id) as { source_type: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.source_type).toBe("graph_node");
  });

  it("should have correct content_hash in SQLite row", () => {
    // Arrange
    const node = makeNode({ title: "Verify Content Hash" });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    const doc = docs[0];
    const expectedHash = contentHash(doc.content);

    // Assert
    const row = store
      .getDb()
      .prepare("SELECT content_hash FROM knowledge_documents WHERE id = ?")
      .get(doc.id) as { content_hash: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content_hash).toBe(expectedHash);
  });

  it("should index graph_node content into FTS5 index", () => {
    // Arrange
    const node = makeNode({ title: "UniqueZebra42 Implementation" });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const rows = store
      .getDb()
      .prepare("SELECT rowid FROM knowledge_fts WHERE knowledge_fts MATCH ?")
      .all("UniqueZebra42") as Array<{ rowid: number }>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
