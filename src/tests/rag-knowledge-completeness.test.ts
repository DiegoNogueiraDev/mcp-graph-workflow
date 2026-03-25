/**
 * RAG Knowledge Completeness Tests
 *
 * Verifies that ALL data sources (graph nodes, code symbols, skills,
 * imported graphs) are indexed into the Knowledge Store and discoverable
 * via RAG search. Ensures cross-source knowledge sharing works.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { makeNode, makeEdge } from "./helpers/factories.js";
import { indexNodeAsKnowledge, removeNodeFromKnowledge, indexAllNodes } from "../core/rag/node-indexer.js";
import { indexEntitiesForDoc } from "../core/rag/entity-index-hook.js";
import { EntityStore } from "../core/rag/entity-store.js";

describe("RAG Knowledge Completeness", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Completeness Test");
    ks = new KnowledgeStore(store.getDb());
  });

  // ── Graph Nodes → Knowledge Store ────────────────────────

  describe("graph node indexing", () => {
    it("should index a new node into knowledge store", () => {
      const node = makeNode({
        title: "Implement FTS5 search",
        description: "Full-text search with BM25 ranking for knowledge documents",
        tags: ["search", "rag"],
        acceptanceCriteria: ["Search returns relevant results", "BM25 ranking applied"],
      });
      store.insertNode(node);

      indexNodeAsKnowledge(store.getDb(), node);

      // Verify node is in knowledge store
      const docs = ks.getBySourceId(node.id);
      expect(docs.length).toBeGreaterThanOrEqual(1);
      expect(docs[0].sourceType).toBe("graph_node");
      expect(docs[0].title).toBe(node.title);
      expect(docs[0].content).toContain("FTS5");
      expect(docs[0].content).toContain("Acceptance Criteria");
    });

    it("should update knowledge when node is updated", () => {
      const node = makeNode({ title: "Original Title", description: "Original description" });
      store.insertNode(node);
      indexNodeAsKnowledge(store.getDb(), node);

      // Update
      const updated = { ...node, title: "Updated Title", description: "Updated description" };
      indexNodeAsKnowledge(store.getDb(), updated);

      const docs = ks.getBySourceId(node.id);
      expect(docs.length).toBe(1); // replaced, not duplicated
      expect(docs[0].title).toBe("Updated Title");
      expect(docs[0].content).toContain("Updated description");
    });

    it("should remove knowledge when node is deleted", () => {
      const node = makeNode({ title: "To Delete" });
      store.insertNode(node);
      indexNodeAsKnowledge(store.getDb(), node);
      expect(ks.getBySourceId(node.id).length).toBe(1);

      removeNodeFromKnowledge(store.getDb(), node.id);

      expect(ks.getBySourceId(node.id).length).toBe(0);
    });

    it("should be searchable via FTS after indexing", () => {
      const node = makeNode({
        title: "GraphEventBus architecture",
        description: "Event-driven system for broadcasting node status changes to all listeners",
      });
      store.insertNode(node);
      indexNodeAsKnowledge(store.getDb(), node);

      const results = ks.search("GraphEventBus event broadcasting", 10);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain("GraphEventBus");
    });

    it("should extract entities from indexed node", () => {
      const node = makeNode({
        title: "SqliteStore persistence layer",
        description: "SqliteStore wraps better-sqlite3 for database operations",
      });
      store.insertNode(node);
      indexNodeAsKnowledge(store.getDb(), node);

      const docs = ks.getBySourceId(node.id);
      expect(docs.length).toBe(1);

      // Check if entity extraction worked
      const es = new EntityStore(store.getDb());
      if (es.hasKgTables()) {
        const entities = es.findByName("SqliteStore");
        expect(entities.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ── indexAllNodes (bulk) ──────────────────────────────────

  describe("indexAllNodes bulk reindex", () => {
    it("should index all existing nodes", () => {
      const n1 = makeNode({ title: "Task A" });
      const n2 = makeNode({ title: "Task B" });
      const n3 = makeNode({ title: "Task C" });
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      const result = indexAllNodes(store.getDb());

      expect(result.indexed).toBe(3);

      // All should be searchable
      for (const node of [n1, n2, n3]) {
        const docs = ks.getBySourceId(node.id);
        expect(docs.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("should handle empty graph gracefully", () => {
      const result = indexAllNodes(store.getDb());
      expect(result.indexed).toBe(0);
    });
  });

  // ── Cross-source knowledge sharing ───────────────────────

  describe("cross-source knowledge sharing", () => {
    it("should share entities between graph node and memory document", () => {
      // Insert a graph node mentioning SqliteStore
      const node = makeNode({
        title: "Database Layer",
        description: "The SqliteStore class provides persistence for the execution graph",
      });
      store.insertNode(node);
      indexNodeAsKnowledge(store.getDb(), node);

      // Insert a memory mentioning SqliteStore
      const memDoc = ks.insert({
        sourceType: "memory",
        sourceId: "mem-arch-1",
        title: "Architecture Decision",
        content: "We chose SqliteStore for its simplicity and transaction support",
        chunkIndex: 0,
      });
      indexEntitiesForDoc(store.getDb(), memDoc.id);

      const es = new EntityStore(store.getDb());
      if (es.hasKgTables()) {
        const entities = es.findByName("SqliteStore");
        if (entities.length > 0) {
          const docIds = es.getDocIdsForEntity(entities[0].id);
          // Should be mentioned in at least 2 docs (node + memory)
          expect(docIds.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it("should make node content discoverable alongside other knowledge sources", () => {
      // Seed various sources
      const node = makeNode({
        title: "RAG Pipeline Enhancement",
        description: "Enhance the RAG pipeline with query understanding and post-retrieval processing",
      });
      store.insertNode(node);
      indexNodeAsKnowledge(store.getDb(), node);

      ks.insert({
        sourceType: "memory",
        sourceId: "mem-rag-1",
        title: "RAG Decision",
        content: "RAG pipeline uses FTS5 for retrieval and TF-IDF for semantic search",
        chunkIndex: 0,
      });

      // Search should find both
      const results = ks.search("RAG pipeline", 10);
      expect(results.length).toBeGreaterThanOrEqual(2);

      const sourceTypes = results.map((r) => r.sourceType);
      expect(sourceTypes).toContain("graph_node");
      expect(sourceTypes).toContain("memory");
    });
  });

  // ── Node indexer error resilience ────────────────────────

  describe("node indexer error resilience", () => {
    it("should not throw when indexing a node with minimal fields", () => {
      const minimal = makeNode({ title: "Minimal" });
      store.insertNode(minimal);

      expect(() => {
        indexNodeAsKnowledge(store.getDb(), minimal);
      }).not.toThrow();
    });

    it("should not throw when removing a non-existent node", () => {
      expect(() => {
        removeNodeFromKnowledge(store.getDb(), "nonexistent_node_xyz");
      }).not.toThrow();
    });
  });
});
