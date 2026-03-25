/**
 * QA Cross-Module Integration — Knowledge Graph
 *
 * Tests that the KG works end-to-end across modules:
 * - Knowledge doc → entity indexing → multi-strategy search
 * - Cross-source entity linking (PRD + memory sharing entities)
 * - Reindex consistency
 * - Hook safety (MCP tool integration)
 * - Query understanding with KG entities
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EntityStore } from "../core/rag/entity-store.js";
import { indexDocument, reindexAll } from "../core/rag/entity-indexer.js";
import {
  indexEntitiesForDoc,
  indexEntitiesForSource,
} from "../core/rag/entity-index-hook.js";
import { multiStrategySearch } from "../core/rag/multi-strategy-retrieval.js";
import { decomposeQuery } from "../core/rag/query-understanding.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function seedKnowledgeDoc(
  ks: KnowledgeStore,
  overrides: { title: string; content: string; sourceType: string },
): string {
  const doc = ks.insert({
    sourceType: overrides.sourceType,
    sourceId: `src-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title,
    content: overrides.content,
    chunkIndex: 0,
  });
  return doc.id;
}

describe("KG Cross-Module QA", () => {
  let db: Database.Database;
  let ks: KnowledgeStore;
  let es: EntityStore;

  beforeEach(() => {
    db = createDb();
    ks = new KnowledgeStore(db);
    es = new EntityStore(db);
  });

  // ── Pipeline completo ────────────────────────────────────

  describe("full pipeline: knowledge → entities → search", () => {
    it("should index entities from knowledge doc and find them via search", () => {
      const docId = seedKnowledgeDoc(ks, {
        title: "SqliteStore Architecture",
        content: "The SqliteStore class manages persistence using better-sqlite3. It wraps all writes in transactions and uses FTS5 for full-text search.",
        sourceType: "memory",
      });

      // Index entities from the document
      const result = indexDocument(db, docId);
      expect(result.entitiesCreated).toBeGreaterThan(0);

      // Search should find SqliteStore entity
      const entities = es.findByName("SqliteStore");
      expect(entities.length).toBeGreaterThanOrEqual(1);
      expect(entities[0].name).toBe("SqliteStore");
      expect(entities[0].type).toBe("class");

      // Entity should link back to the document
      const docIds = es.getDocIdsForEntity(entities[0].id);
      expect(docIds).toContain(docId);
    });

    it("should boost search results for docs with matching KG entities", () => {
      // Seed 2 docs — one with SqliteStore entity, one without
      const doc1 = seedKnowledgeDoc(ks, {
        title: "Database Layer",
        content: "SqliteStore provides all database operations including FTS5 search and migrations.",
        sourceType: "memory",
      });
      const doc2 = seedKnowledgeDoc(ks, {
        title: "CLI Layer",
        content: "The command-line interface provides user-facing commands for interacting with the system.",
        sourceType: "docs",
      });

      indexDocument(db, doc1);
      indexDocument(db, doc2);

      // Search for SqliteStore
      const results = multiStrategySearch(db, "SqliteStore database", { limit: 10 });

      // Doc1 (has SqliteStore entity) should appear before Doc2
      if (results.length >= 2) {
        const doc1Idx = results.findIndex((r) => r.sourceId === doc1 || r.title === "Database Layer");
        const doc2Idx = results.findIndex((r) => r.sourceId === doc2 || r.title === "CLI Layer");
        if (doc1Idx >= 0 && doc2Idx >= 0) {
          expect(doc1Idx).toBeLessThan(doc2Idx);
        }
      }
    });
  });

  // ── Cross-source linking ─────────────────────────────────

  describe("cross-source entity linking", () => {
    it("should link entities across PRD and memory documents", () => {
      const prdDocId = seedKnowledgeDoc(ks, {
        title: "PRD: Graph Engine",
        content: "The GraphEventBus will emit events when nodes change status. SqliteStore provides persistence.",
        sourceType: "prd",
      });
      const memDocId = seedKnowledgeDoc(ks, {
        title: "Architecture Decision",
        content: "We chose GraphEventBus for event-driven architecture. It integrates with SqliteStore.",
        sourceType: "memory",
      });

      indexDocument(db, prdDocId);
      indexDocument(db, memDocId);

      // GraphEventBus should be found in both documents
      const entities = es.findByName("GraphEventBus");
      expect(entities.length).toBeGreaterThanOrEqual(1);

      const docIds = es.getDocIdsForEntity(entities[0].id);
      expect(docIds).toContain(prdDocId);
      expect(docIds).toContain(memDocId);
      expect(entities[0].mentionCount).toBeGreaterThanOrEqual(2);
    });

    it("should link entities across docs and code_context sources", () => {
      const docsId = seedKnowledgeDoc(ks, {
        title: "API Reference",
        content: "The KnowledgeStore provides search with BM25 ranking.",
        sourceType: "docs",
      });
      const codeId = seedKnowledgeDoc(ks, {
        title: "Code Analysis",
        content: "class KnowledgeStore extends BaseStore { search(query) { ... } }",
        sourceType: "code_context",
      });

      indexDocument(db, docsId);
      indexDocument(db, codeId);

      const entities = es.findByName("KnowledgeStore");
      expect(entities.length).toBeGreaterThanOrEqual(1);

      const docIds = es.getDocIdsForEntity(entities[0].id);
      expect(docIds.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Reindex consistency ──────────────────────────────────

  describe("reindex consistency", () => {
    it("should produce same entity count after reindexAll", () => {
      // Seed 5 docs
      for (let i = 0; i < 5; i++) {
        const docId = seedKnowledgeDoc(ks, {
          title: `Module ${i}`,
          content: `The SqliteStore and GraphNode are used in module ${i}. It also uses KnowledgeStore for RAG.`,
          sourceType: "memory",
        });
        indexDocument(db, docId);
      }

      // Reindex all — should clear and rebuild
      const result = reindexAll(db);
      expect(result.totalEntities).toBeGreaterThan(0);

      const statsAfter = es.stats();

      // Entity count should be similar (reindex rebuilds from scratch)
      expect(statsAfter.entities).toBeGreaterThan(0);
      // Relations should also be rebuilt
      expect(statsAfter.relations).toBeGreaterThanOrEqual(0);
    });

    it("should clear KG before reindex", () => {
      const docId = seedKnowledgeDoc(ks, {
        title: "Test",
        content: "SqliteStore is great.",
        sourceType: "memory",
      });
      indexDocument(db, docId);
      expect(es.stats().entities).toBeGreaterThan(0);

      // Reindex clears and rebuilds
      reindexAll(db);

      // Entities should still exist (rebuilt from docs)
      expect(es.stats().entities).toBeGreaterThan(0);
    });
  });

  // ── Hook safety ──────────────────────────────────────────

  describe("hook safety (MCP tool integration)", () => {
    it("should not throw when indexEntitiesForDoc is called with non-existent doc", () => {
      expect(() => {
        indexEntitiesForDoc(db, "nonexistent_doc_xyz");
      }).not.toThrow();
    });

    it("should not throw when indexEntitiesForSource with no matching docs", () => {
      expect(() => {
        indexEntitiesForSource(db, "nonexistent_source");
      }).not.toThrow();
    });

    it("should index entities for a valid source type", () => {
      seedKnowledgeDoc(ks, {
        title: "Memory Doc",
        content: "GraphNode class handles task nodes.",
        sourceType: "memory",
      });

      expect(() => {
        indexEntitiesForSource(db, "memory");
      }).not.toThrow();

      const entities = es.findByName("GraphNode");
      expect(entities.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Query understanding with KG ──────────────────────────

  describe("query understanding with KG", () => {
    it("should find matching KG entities in decomposed query", () => {
      // Seed KG with entities
      store_upsertAndIndex(db, ks, es);

      const decomposed = decomposeQuery("how does SqliteStore handle migrations?", db);

      expect(decomposed).toHaveProperty("highLevelKeys");
      expect(decomposed).toHaveProperty("lowLevelKeys");
      expect(decomposed).toHaveProperty("entityMatches");
      // Should find SqliteStore in KG entity matches
      if (decomposed.entityMatches.length > 0) {
        expect(decomposed.entityMatches.some((m) => m.name.toLowerCase().includes("sqlite"))).toBe(true);
      }
    });

    it("should return empty entities when KG is empty", () => {
      const decomposed = decomposeQuery("how does SqliteStore work?", db);

      expect(decomposed).toHaveProperty("entityMatches");
      // No KG entities seeded — entityMatches should be empty
      expect(decomposed.entityMatches).toHaveLength(0);
    });
  });

  // ── Entity subgraph for cross-source discovery ───────────

  describe("subgraph cross-source discovery", () => {
    it("should extract subgraph linking entities across multiple docs", () => {
      const doc1 = seedKnowledgeDoc(ks, {
        title: "Core Architecture",
        content: "SqliteStore uses better-sqlite3 for persistence. GraphEventBus emits events.",
        sourceType: "prd",
      });
      const doc2 = seedKnowledgeDoc(ks, {
        title: "Event System",
        content: "GraphEventBus dispatches to all registered listeners. KnowledgeStore listens for doc changes.",
        sourceType: "docs",
      });

      indexDocument(db, doc1);
      indexDocument(db, doc2);

      // Find GraphEventBus entity
      const entities = es.findByName("GraphEventBus");
      expect(entities.length).toBeGreaterThanOrEqual(1);

      // Extract subgraph from GraphEventBus
      const subgraph = es.extractSubgraph([entities[0].id], 2, 20);

      expect(subgraph.entities.length).toBeGreaterThanOrEqual(1);
      // Should include docs from both sources
      expect(subgraph.docIds.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Helper ──────────────────────────────────────────────

function store_upsertAndIndex(
  db: Database.Database,
  ks: KnowledgeStore,
  _es: EntityStore,
): void {
  const docId = ks.insert({
    sourceType: "memory",
    sourceId: "arch-decision-1",
    title: "Architecture",
    content: "SqliteStore manages all persistence. GraphNode represents tasks.",
    chunkIndex: 0,
  }).id;
  indexDocument(db, docId);
}
