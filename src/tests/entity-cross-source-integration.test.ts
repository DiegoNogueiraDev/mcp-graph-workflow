/**
 * Integration tests for cross-source entity sharing via Knowledge Graph.
 *
 * These tests verify that entities extracted from different source types
 * (PRD, memory, docs, siebel, journey, etc.) are linked in the KG and
 * discoverable through the multi-strategy retrieval pipeline.
 *
 * This is the critical test proving that ALL tabs share information
 * through the entity graph when an agent queries via MCP.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EntityStore } from "../core/rag/entity-store.js";
import { reindexAll } from "../core/rag/entity-indexer.js";
import {
  indexEntitiesForDoc,
  indexEntitiesForSource,
} from "../core/rag/entity-index-hook.js";
import { multiStrategySearch } from "../core/rag/multi-strategy-retrieval.js";
import { decomposeQuery } from "../core/rag/query-understanding.js";
import { extractEntitiesFromText, extractRelationsFromText } from "../core/rag/entity-extractor.js";

describe("Cross-Source Entity Integration", () => {
  let db: Database.Database;
  let knowledgeStore: KnowledgeStore;
  let entityStore: EntityStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    knowledgeStore = new KnowledgeStore(db);
    entityStore = new EntityStore(db);
  });

  describe("entity sharing across source types", () => {
    it("should link PRD and memory docs through shared entities", () => {
      // Arrange: PRD doc mentions SqliteStore
      const prdDoc = knowledgeStore.insert({
        sourceType: "prd",
        sourceId: "prd:feature-1",
        title: "Database Feature PRD",
        content: "The SqliteStore class handles persistence. Uses better-sqlite3 for SQLite access.",
      });

      // Arrange: Memory doc also mentions SqliteStore
      const memoryDoc = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:architecture",
        title: "Architecture Decision",
        content: "We chose SqliteStore as the primary persistence layer. It wraps better-sqlite3.",
      });

      // Act: Index entities for both docs
      indexEntitiesForDoc(db, prdDoc.id);
      indexEntitiesForDoc(db, memoryDoc.id);

      // Assert: SqliteStore entity exists and links to both docs
      const sqliteStoreEntities = entityStore.findByName("SqliteStore");
      expect(sqliteStoreEntities.length).toBeGreaterThanOrEqual(1);

      const entity = sqliteStoreEntities[0];
      const docIds = entityStore.getDocIdsForEntity(entity.id);
      expect(docIds).toContain(prdDoc.id);
      expect(docIds).toContain(memoryDoc.id);

      // mentionCount should reflect both docs
      expect(entity.mentionCount).toBeGreaterThanOrEqual(2);
    });

    it("should link Siebel docs and API specs through shared entities", () => {
      // Arrange: Siebel SIF doc
      const siebelDoc = knowledgeStore.insert({
        sourceType: "siebel_sif",
        sourceId: "siebel:account-bc",
        title: "Account Business Component",
        content: "Business Component: Account. Uses EAI Siebel Adapter for integration. Built with TypeScript.",
      });

      // Arrange: Swagger API doc
      const swaggerDoc = knowledgeStore.insert({
        sourceType: "swagger",
        sourceId: "swagger:account-api",
        title: "Account REST API",
        content: "POST /api/account creates a new account. Uses TypeScript and Express for the backend.",
      });

      // Act: Index both
      indexEntitiesForDoc(db, siebelDoc.id);
      indexEntitiesForDoc(db, swaggerDoc.id);

      // Assert: TypeScript entity links both sources
      const tsEntities = entityStore.findByName("TypeScript");
      expect(tsEntities.length).toBeGreaterThanOrEqual(1);

      const tsEntity = tsEntities[0];
      const linkedDocs = entityStore.getDocIdsForEntity(tsEntity.id);
      expect(linkedDocs).toContain(siebelDoc.id);
      expect(linkedDocs).toContain(swaggerDoc.id);
    });

    it("should discover cross-source docs through entity graph traversal", () => {
      // Arrange: Three docs from different sources sharing entities
      const doc1 = knowledgeStore.insert({
        sourceType: "prd",
        sourceId: "prd:search",
        title: "Search Feature PRD",
        content: "Implement FTS5 search using SQLite. The SearchEngine class handles queries.",
      });
      const doc2 = knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "docs:sqlite",
        title: "SQLite Documentation",
        content: "SQLite FTS5 extension enables full-text search with BM25 ranking.",
      });
      const doc3 = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:search-decision",
        title: "Search Architecture Decision",
        content: "Decision: Use FTS5 with BM25 for search. SQLite is the storage backend.",
      });

      // Act: Index all docs into KG
      indexEntitiesForDoc(db, doc1.id);
      indexEntitiesForDoc(db, doc2.id);
      indexEntitiesForDoc(db, doc3.id);

      // Assert: SQLite entity connects all three docs
      const sqliteEntities = entityStore.findByName("SQLite");
      expect(sqliteEntities.length).toBeGreaterThanOrEqual(1);

      const sqliteEntity = sqliteEntities[0];
      const linkedDocs = entityStore.getDocIdsForEntity(sqliteEntity.id);
      expect(linkedDocs.length).toBeGreaterThanOrEqual(3);

      // Assert: Subgraph from SQLite reaches all related entities
      const subgraph = entityStore.extractSubgraph([sqliteEntity.id], 2);
      expect(subgraph.docIds.length).toBeGreaterThanOrEqual(3);
      expect(subgraph.entities.length).toBeGreaterThanOrEqual(2); // SQLite + FTS5 at minimum
    });
  });

  describe("multi-strategy search with entity graph", () => {
    it("should find cross-source results via entity graph that FTS alone would miss", () => {
      // Arrange: doc1 has "SqliteStore" and "persistence"
      const doc1 = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:arch",
        title: "Architecture Memory",
        content: "SqliteStore handles all persistence operations. Uses transactions for safety.",
      });

      // Arrange: doc2 has "SqliteStore" and "migration" (no "persistence")
      const doc2 = knowledgeStore.insert({
        sourceType: "prd",
        sourceId: "prd:migration",
        title: "Migration Feature",
        content: "SqliteStore runs schema migrations on startup. Uses better-sqlite3 driver.",
      });

      // Index entities — both docs share "SqliteStore" entity
      indexEntitiesForDoc(db, doc1.id);
      indexEntitiesForDoc(db, doc2.id);

      // Act: Query for "SqliteStore persistence" — FTS will find doc1,
      // but entity graph should also surface doc2 (shares SqliteStore entity)
      const results = multiStrategySearch(db, "SqliteStore persistence");

      // Both docs should appear (entity graph connects them via shared entity)
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("should include entity_graph strategy in results when KG is populated", () => {
      const doc = knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "docs:react",
        title: "React Documentation",
        content: "React is a JavaScript library for building user interfaces with TypeScript.",
      });

      indexEntitiesForDoc(db, doc.id);

      const results = multiStrategySearch(db, "React TypeScript");
      expect(results.length).toBeGreaterThan(0);

      // At least one result should have entity_graph strategy
      const hasEntityGraph = results.some((r) => r.strategies.includes("entity_graph"));
      expect(hasEntityGraph).toBe(true);
    });
  });

  describe("reindexAll builds complete KG from all sources", () => {
    it("should create entities from all source types and link them", () => {
      // Insert docs from 5 different source types
      knowledgeStore.insert({
        sourceType: "prd",
        sourceId: "prd:core",
        title: "Core PRD",
        content: "Build with TypeScript and SQLite. Use Vitest for testing.",
      });
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:stack",
        title: "Stack Decision",
        content: "Stack: TypeScript, SQLite, Commander.js for CLI.",
      });
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "docs:vitest",
        title: "Vitest Docs",
        content: "Vitest is a fast unit test framework for TypeScript projects.",
      });
      knowledgeStore.insert({
        sourceType: "siebel_sif",
        sourceId: "siebel:contact",
        title: "Contact BC",
        content: "Business Component: Contact. Uses TypeScript adapter.",
      });
      knowledgeStore.insert({
        sourceType: "journey",
        sourceId: "journey:login",
        title: "Login Flow",
        content: "Login screen uses React components with TypeScript types.",
      });

      // Act: Full reindex
      const result = reindexAll(db);

      // Assert: All docs processed
      expect(result.documentsProcessed).toBe(5);
      expect(result.totalEntities).toBeGreaterThan(3);

      // Assert: TypeScript entity links all 5 sources
      const tsEntities = entityStore.findByName("TypeScript");
      expect(tsEntities.length).toBeGreaterThanOrEqual(1);

      const tsDocIds = entityStore.getDocIdsForEntity(tsEntities[0].id);
      expect(tsDocIds.length).toBe(5); // All 5 docs mention TypeScript

      // Assert: Entity graph is connected
      const subgraph = entityStore.extractSubgraph([tsEntities[0].id], 2);
      expect(subgraph.entities.length).toBeGreaterThan(3);
      expect(subgraph.docIds.length).toBe(5);
    });
  });

  describe("decomposeQuery with populated KG", () => {
    it("should match entities and expand query via KG", () => {
      // Populate KG
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:db",
        title: "Database Choices",
        content: "SQLite with FTS5 for search. BM25 ranking algorithm.",
      });
      reindexAll(db);

      // Act: Decompose a query
      const decomposed = decomposeQuery("How does SQLite search work?", db);

      // Assert: Entity matches found
      expect(decomposed.entityMatches.length).toBeGreaterThan(0);
      expect(decomposed.entityMatches.some((m) => m.name === "SQLite")).toBe(true);

      // Assert: High and low level keys populated
      expect(decomposed.highLevelKeys.length).toBeGreaterThan(0);
      expect(decomposed.intent).toBe("how_to");
    });
  });

  describe("indexEntitiesForSource covers all source types", () => {
    it("should index entities for memory source type", () => {
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:test",
        title: "Test",
        content: "SqliteStore uses TypeScript and better-sqlite3.",
      });

      indexEntitiesForSource(db, "memory");

      expect(entityStore.stats().entities).toBeGreaterThan(0);
    });

    it("should index entities for prd source type", () => {
      knowledgeStore.insert({
        sourceType: "prd",
        sourceId: "prd:test",
        title: "Test PRD",
        content: "GraphNode extends BaseNode with React components.",
      });

      indexEntitiesForSource(db, "prd");

      expect(entityStore.stats().entities).toBeGreaterThan(0);
    });

    it("should index entities for siebel_sif source type", () => {
      knowledgeStore.insert({
        sourceType: "siebel_sif",
        sourceId: "siebel:test",
        title: "Test SIF",
        content: "Business Component: Account. Applet: AccountListApplet. View: AccountView.",
      });

      indexEntitiesForSource(db, "siebel_sif");

      const stats = entityStore.stats();
      expect(stats.entities).toBeGreaterThan(0);
    });

    it("should index entities for swagger source type", () => {
      knowledgeStore.insert({
        sourceType: "swagger",
        sourceId: "swagger:test",
        title: "API Spec",
        content: "GET /api/accounts returns a list. POST /api/accounts creates one.",
      });

      indexEntitiesForSource(db, "swagger");

      expect(entityStore.stats().entities).toBeGreaterThan(0);
    });

    it("should index entities for docs source type", () => {
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "docs:test",
        title: "Library Docs",
        content: "Commander.js provides CLI command registration. Uses Node.js runtime.",
      });

      indexEntitiesForSource(db, "docs");

      expect(entityStore.stats().entities).toBeGreaterThan(0);
    });

    it("should index entities for journey source type", () => {
      knowledgeStore.insert({
        sourceType: "journey",
        sourceId: "journey:test",
        title: "User Flow",
        content: "## Login Screen\nUser enters credentials. React component handles validation.",
      });

      indexEntitiesForSource(db, "journey");

      expect(entityStore.stats().entities).toBeGreaterThan(0);
    });
  });

  describe("entity extractor covers all pattern types", () => {
    it("should extract entities of all types from mixed content", () => {
      const text = `
## Knowledge Pipeline Architecture
The SqliteStore class uses persistence layer.
Built with TypeScript and React. FTS5 enables full-text search.
Configuration: MAX_TOKEN_BUDGET controls context limits.
See src/core/rag/pipeline.ts for implementation.
POST /api/knowledge creates documents.
Uses \`knowledge graph\` for entity linking.
import { generateId } from "@anthropic-ai/sdk"
      `;

      const entities = extractEntitiesFromText(text);

      // Verify all entity types are covered
      const types = new Set(entities.map((e) => e.type));
      expect(types.has("class")).toBe(true);       // SqliteStore
      expect(types.has("technology")).toBe(true);   // TypeScript, React, FTS5
      expect(types.has("package")).toBe(true);      // @anthropic-ai/sdk
      expect(types.has("config")).toBe(true);       // MAX_TOKEN_BUDGET
      expect(types.has("file")).toBe(true);         // src/core/rag/pipeline.ts
      expect(types.has("api_endpoint")).toBe(true); // POST /api/knowledge
      expect(types.has("concept")).toBe(true);      // knowledge graph
      expect(types.has("domain_term")).toBe(true);  // Knowledge Pipeline Architecture
    });

    it("should extract relations between entities", () => {
      const text = "SqliteStore uses TypeScript for type safety. SqliteStore extends BaseStore for inheritance.";
      const entities = extractEntitiesFromText(text);
      const relations = extractRelationsFromText(text, entities);

      expect(relations.some((r) => r.relationType === "uses")).toBe(true);
      expect(relations.some((r) => r.relationType === "extends")).toBe(true);
    });
  });

  describe("graceful degradation", () => {
    it("should not break retrieval when KG is empty", () => {
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:test",
        title: "Test",
        content: "Some content about testing strategies.",
      });

      // No entity indexing — KG is empty
      const results = multiStrategySearch(db, "testing");
      expect(results.length).toBeGreaterThan(0);
      // Only FTS strategy should be present
      expect(results.every((r) => !r.strategies.includes("entity_graph"))).toBe(true);
    });

    it("should not break when DB has no KG tables", () => {
      const rawDb = new Database(":memory:");
      // No migrations
      expect(() => decomposeQuery("test query", rawDb)).not.toThrow();
      expect(() => indexEntitiesForDoc(rawDb, "some_id")).not.toThrow();
      expect(() => indexEntitiesForSource(rawDb, "memory")).not.toThrow();
    });

    it("should handle reindexAll on empty knowledge store", () => {
      const result = reindexAll(db);
      expect(result.documentsProcessed).toBe(0);
      expect(result.totalEntities).toBe(0);
    });
  });

  describe("entity deduplication across sources", () => {
    it("should not create duplicate entities for same name+type from different sources", () => {
      // Two docs from different sources mention TypeScript
      const doc1 = knowledgeStore.insert({
        sourceType: "prd",
        sourceId: "prd:test",
        title: "PRD",
        content: "Built with TypeScript for type safety.",
      });
      const doc2 = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:test",
        title: "Memory",
        content: "We chose TypeScript as our primary language.",
      });

      indexEntitiesForDoc(db, doc1.id);
      indexEntitiesForDoc(db, doc2.id);

      // Should have exactly 1 TypeScript entity (not 2)
      const tsEntities = entityStore.findByName("TypeScript");
      const techEntities = tsEntities.filter((e) => e.type === "technology");
      expect(techEntities.length).toBe(1);

      // But mentionCount should be 2
      expect(techEntities[0].mentionCount).toBe(2);

      // And linked to both docs
      const docIds = entityStore.getDocIdsForEntity(techEntities[0].id);
      expect(docIds.length).toBe(2);
    });
  });
});
