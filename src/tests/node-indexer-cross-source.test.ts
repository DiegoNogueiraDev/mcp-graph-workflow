/**
 * Cross-source knowledge sharing tests for graph_node indexer.
 *
 * Verifies that graph_node knowledge integrates with all other source types:
 * entities are shared, FTS search returns mixed results, entity graph
 * traversal finds graph_node docs.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EntityStore } from "../core/rag/entity-store.js";
import { indexEntitiesForDoc } from "../core/rag/entity-index-hook.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import {
  indexNodeAsKnowledge,
  removeNodeFromKnowledge,
} from "../core/rag/node-indexer.js";

let store: SqliteStore;
let ks: KnowledgeStore;
let es: EntityStore;

beforeEach(() => {
  store = SqliteStore.open(":memory:");
  store.initProject("Cross Source Test");
  ks = new KnowledgeStore(store.getDb());
  es = new EntityStore(store.getDb());
});

describe("Node Indexer Cross-Source Knowledge Sharing", () => {
  describe("entity sharing across sources", () => {
    it("should share entities between graph_node and memory", () => {
      // Arrange: node mentioning SqliteStore
      const node = makeNode({
        title: "Database Layer",
        description: "The SqliteStore class provides persistence",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      // Arrange: memory doc also mentioning SqliteStore
      const memoryDoc = ks.insert({
        sourceType: "memory",
        sourceId: "memory:arch-decision",
        title: "Architecture Decision",
        content: "We chose SqliteStore as the primary persistence layer.",
      });
      indexEntitiesForDoc(store.getDb(), memoryDoc.id);

      // Assert: shared entity links both docs
      if (es.hasKgTables()) {
        const entities = es.findByName("SqliteStore");
        expect(entities.length).toBeGreaterThanOrEqual(1);

        const entity = entities[0];
        const nodeDocs = ks.getBySourceId(node.id);
        expect(nodeDocs.length).toBeGreaterThanOrEqual(1);

        const docIds = es.getDocIdsForEntity(entity.id);
        expect(docIds).toContain(nodeDocs[0].id);
        expect(docIds).toContain(memoryDoc.id);
      }
    });

    it("should share entities between graph_node and prd", () => {
      // Arrange: node about FTS5
      const node = makeNode({
        title: "FTS5 search implementation",
        description: "Implement FTS5 full-text search for the knowledge store",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      // Arrange: prd doc about FTS5
      const prdDoc = ks.insert({
        sourceType: "prd",
        sourceId: "prd:search-feature",
        title: "Search Feature PRD",
        content: "FTS5 full-text search enables fast document retrieval.",
      });
      indexEntitiesForDoc(store.getDb(), prdDoc.id);

      // Assert: shared entity FTS5 links both docs
      if (es.hasKgTables()) {
        const entities = es.findByName("FTS5");
        expect(entities.length).toBeGreaterThanOrEqual(1);

        const entity = entities[0];
        const nodeDocs = ks.getBySourceId(node.id);
        const docIds = es.getDocIdsForEntity(entity.id);
        expect(docIds).toContain(nodeDocs[0].id);
        expect(docIds).toContain(prdDoc.id);
      }
    });

    it("should share entities between graph_node and code_context", () => {
      // Arrange: node mentioning KnowledgeStore
      const node = makeNode({
        title: "Knowledge Store refactor",
        description: "Refactor the KnowledgeStore class for better performance",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      // Arrange: code_context doc about KnowledgeStore
      const codeDoc = ks.insert({
        sourceType: "code_context",
        sourceId: "code:knowledge-store-module",
        title: "KnowledgeStore module",
        content:
          "The KnowledgeStore module handles CRUD and FTS search for knowledge documents.",
      });
      indexEntitiesForDoc(store.getDb(), codeDoc.id);

      // Assert: shared entity links both docs
      if (es.hasKgTables()) {
        const entities = es.findByName("KnowledgeStore");
        expect(entities.length).toBeGreaterThanOrEqual(1);

        const entity = entities[0];
        const nodeDocs = ks.getBySourceId(node.id);
        const docIds = es.getDocIdsForEntity(entity.id);
        expect(docIds).toContain(nodeDocs[0].id);
        expect(docIds).toContain(codeDoc.id);
      }
    });
  });

  describe("FTS search across source types", () => {
    it("should return graph_node and docs in mixed FTS search", () => {
      // Arrange: node about Express middleware
      const node = makeNode({
        title: "Express routing middleware",
        description:
          "Implement Express middleware for request validation and routing.",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      // Arrange: docs source about Express middleware
      ks.insert({
        sourceType: "docs",
        sourceId: "docs:express-middleware",
        title: "Express middleware patterns",
        content:
          "Express middleware patterns for authentication, logging, and routing.",
      });

      // Act
      const results = ks.search("Express middleware", 10);

      // Assert: both source types appear
      expect(results.length).toBeGreaterThanOrEqual(2);
      const sourceTypes = results.map((r) => r.sourceType);
      expect(sourceTypes).toContain("graph_node");
      expect(sourceTypes).toContain("docs");
    });

    it("should rank graph_node alongside multiple source types", () => {
      // Arrange: 5 docs of different sourceTypes all about RAG pipeline
      const node = makeNode({
        title: "RAG pipeline optimization",
        description: "Optimize the RAG pipeline for faster retrieval.",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      ks.insert({
        sourceType: "memory",
        sourceId: "memory:rag-decision",
        title: "RAG Decision",
        content: "RAG pipeline uses BM25 for ranking knowledge documents.",
      });

      ks.insert({
        sourceType: "docs",
        sourceId: "docs:rag-guide",
        title: "RAG Guide",
        content: "RAG pipeline architecture and retrieval strategies.",
      });

      ks.insert({
        sourceType: "prd",
        sourceId: "prd:rag-feature",
        title: "RAG Feature PRD",
        content: "RAG pipeline must support tiered context budgets.",
      });

      ks.insert({
        sourceType: "code_context",
        sourceId: "code:rag-pipeline",
        title: "RAG Pipeline Module",
        content: "RAG pipeline orchestrates search, ranking, and assembly.",
      });

      // Act
      const results = ks.search("RAG pipeline", 10);

      // Assert: all 5 source types appear
      expect(results.length).toBeGreaterThanOrEqual(5);
      const sourceTypes = results.map((r) => r.sourceType);
      expect(sourceTypes).toContain("graph_node");
      expect(sourceTypes).toContain("memory");
      expect(sourceTypes).toContain("docs");
      expect(sourceTypes).toContain("prd");
      expect(sourceTypes).toContain("code_context");
    });

    it("should discover all source types in a single query", () => {
      // Arrange: one doc each of 4 sourceTypes mentioning performance optimization
      const node = makeNode({
        title: "Performance optimization task",
        description: "Improve performance optimization across the pipeline.",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      ks.insert({
        sourceType: "memory",
        sourceId: "memory:perf",
        title: "Performance Memory",
        content: "Performance optimization reduced query time by 40%.",
      });

      ks.insert({
        sourceType: "docs",
        sourceId: "docs:perf",
        title: "Performance Docs",
        content: "Performance optimization best practices for SQLite.",
      });

      ks.insert({
        sourceType: "prd",
        sourceId: "prd:perf",
        title: "Performance PRD",
        content: "Performance optimization is a P1 requirement for v2.",
      });

      // Act
      const results = ks.search("performance optimization", 10);

      // Assert: all 4 source types appear
      expect(results.length).toBeGreaterThanOrEqual(4);
      const sourceTypes = results.map((r) => r.sourceType);
      expect(sourceTypes).toContain("graph_node");
      expect(sourceTypes).toContain("memory");
      expect(sourceTypes).toContain("docs");
      expect(sourceTypes).toContain("prd");
    });
  });

  describe("deletion and entity integrity", () => {
    it("should remove graph_node mentions but not shared entity on deletion", () => {
      // Arrange: node and memory both mentioning SqliteStore
      const node = makeNode({
        title: "Database Layer",
        description: "The SqliteStore class provides persistence",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      const memoryDoc = ks.insert({
        sourceType: "memory",
        sourceId: "memory:db-choice",
        title: "DB Choice",
        content: "We use SqliteStore for all data persistence.",
      });
      indexEntitiesForDoc(store.getDb(), memoryDoc.id);

      // Act: delete graph_node
      removeNodeFromKnowledge(store.getDb(), node.id);

      // Assert: entity still exists (from memory mention)
      if (es.hasKgTables()) {
        const entities = es.findByName("SqliteStore");
        expect(entities.length).toBeGreaterThanOrEqual(1);

        // Memory doc should still be linked
        const docIds = es.getDocIdsForEntity(entities[0].id);
        expect(docIds).toContain(memoryDoc.id);
      }
    });
  });

  describe("entity mention cleanup on deletion", () => {
    it("should clean up kg_mentions when knowledge doc is deleted", () => {
      // Arrange: node mentioning SqliteStore
      const node = makeNode({
        title: "Database Layer Cleanup",
        description: "The SqliteStore class handles persistence",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      if (es.hasKgTables()) {
        const nodeDoc = ks.getBySourceId(node.id)[0];
        expect(nodeDoc).toBeDefined();

        // Get mentions before deletion
        const mentionsBefore = store.getDb()
          .prepare("SELECT * FROM kg_mentions WHERE doc_id = ?")
          .all(nodeDoc.id) as Array<{ id: string; doc_id: string }>;

        // Act: delete the knowledge doc via removeNodeFromKnowledge
        removeNodeFromKnowledge(store.getDb(), node.id);

        // Assert: knowledge doc is gone
        expect(ks.getBySourceId(node.id)).toHaveLength(0);

        // Mentions should be cleaned up (no orphans)
        if (mentionsBefore.length > 0) {
          const mentionsAfter = store.getDb()
            .prepare("SELECT * FROM kg_mentions WHERE doc_id = ?")
            .all(nodeDoc.id) as Array<{ id: string; doc_id: string }>;
          expect(mentionsAfter.length).toBe(0);
        }
      }
    });
  });

  describe("entity graph traversal", () => {
    it("should find graph_node docs via entity graph traversal", () => {
      // Arrange: node mentioning EntityStore
      const node = makeNode({
        title: "Entity Store improvements",
        description: "Improve the EntityStore class for better graph traversal",
      });
      indexNodeAsKnowledge(store.getDb(), node);

      // Arrange: memory mentioning EntityStore
      const memoryDoc = ks.insert({
        sourceType: "memory",
        sourceId: "memory:entity-patterns",
        title: "Entity Patterns",
        content: "EntityStore patterns for efficient graph traversal and BFS.",
      });
      indexEntitiesForDoc(store.getDb(), memoryDoc.id);

      // Assert: entity links both docs via traversal
      if (es.hasKgTables()) {
        const entities = es.findByName("EntityStore");
        expect(entities.length).toBeGreaterThanOrEqual(1);

        const entityId = entities[0].id;
        const docIds = es.getDocIdsForEntity(entityId);
        const nodeDocs = ks.getBySourceId(node.id);

        expect(docIds).toContain(nodeDocs[0].id);
        expect(docIds).toContain(memoryDoc.id);
      }
    });
  });
});
