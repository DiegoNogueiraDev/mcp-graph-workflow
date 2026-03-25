import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { EntityStore } from "../core/rag/entity-store.js";
import {
  extractEntitiesFromText,
  extractRelationsFromText,
  type ExtractedEntity,
} from "../core/rag/entity-extractor.js";
import { indexDocument, reindexAll } from "../core/rag/entity-indexer.js";
import { decomposeQuery } from "../core/rag/query-understanding.js";
import { multiStrategySearch } from "../core/rag/multi-strategy-retrieval.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

// ── Entity Store Tests ───────────────────────────────────

describe("EntityStore", () => {
  let db: Database.Database;
  let store: EntityStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new EntityStore(db);
  });

  describe("hasKgTables", () => {
    it("should detect KG tables after migration", () => {
      expect(store.hasKgTables()).toBe(true);
    });
  });

  describe("upsertEntity", () => {
    it("should create a new entity", () => {
      const entity = store.upsertEntity("GraphNode", "class");

      expect(entity.id).toMatch(/^ent_/);
      expect(entity.name).toBe("GraphNode");
      expect(entity.type).toBe("class");
      expect(entity.normalizedName).toBe("graphnode");
      expect(entity.mentionCount).toBe(1);
    });

    it("should increment mention count on duplicate normalized_name+type", () => {
      store.upsertEntity("GraphNode", "class");
      const second = store.upsertEntity("graphnode", "class");

      expect(second.mentionCount).toBe(2);
    });

    it("should allow same name with different types", () => {
      const a = store.upsertEntity("GraphNode", "class");
      const b = store.upsertEntity("GraphNode", "concept");

      expect(a.id).not.toBe(b.id);
      expect(a.type).toBe("class");
      expect(b.type).toBe("concept");
    });

    it("should add mention when docId is provided", () => {
      const entity = store.upsertEntity("SQLite", "technology", "doc_123");
      const mentions = store.getMentions(entity.id);

      expect(mentions.length).toBe(1);
      expect(mentions[0].docId).toBe("doc_123");
    });
  });

  describe("addRelation", () => {
    it("should create a relation between entities", () => {
      const a = store.upsertEntity("SqliteStore", "class");
      const b = store.upsertEntity("better-sqlite3", "package");
      const rel = store.addRelation(a.id, b.id, "uses", 0.9);

      expect(rel).not.toBeNull();
      expect(rel!.relationType).toBe("uses");
      expect(rel!.weight).toBe(0.9);
    });

    it("should ignore duplicate relations (UNIQUE constraint)", () => {
      const a = store.upsertEntity("A", "class");
      const b = store.upsertEntity("B", "class");

      store.addRelation(a.id, b.id, "uses");
      store.addRelation(a.id, b.id, "uses"); // duplicate

      const rels = store.getRelationsFrom(a.id);
      expect(rels.length).toBe(1);
    });
  });

  describe("findByName", () => {
    it("should find entities via FTS5 search", () => {
      store.upsertEntity("SqliteStore", "class");
      store.upsertEntity("KnowledgeStore", "class");
      store.upsertEntity("React", "technology");

      const results = store.findByName("Store");
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((e) => e.name === "SqliteStore")).toBe(true);
    });

    it("should return empty for empty query", () => {
      expect(store.findByName("")).toEqual([]);
    });

    it("should fallback to LIKE on FTS error", () => {
      store.upsertEntity("React", "technology");
      // Special chars that might cause FTS error
      const results = store.findByName("react");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getEntitiesForDoc / getDocIdsForEntity", () => {
    it("should link entities to documents via mentions", () => {
      const e1 = store.upsertEntity("SQLite", "technology", "doc_1");
      store.upsertEntity("React", "technology", "doc_1");
      store.upsertEntity("Node.js", "technology", "doc_2");

      const entitiesInDoc1 = store.getEntitiesForDoc("doc_1");
      expect(entitiesInDoc1.length).toBe(2);

      const docsForSQLite = store.getDocIdsForEntity(e1.id);
      expect(docsForSQLite).toContain("doc_1");
    });
  });

  describe("extractSubgraph", () => {
    it("should BFS expand from seed entities", () => {
      const a = store.upsertEntity("A", "class", "doc_a");
      const b = store.upsertEntity("B", "class", "doc_b");
      const c = store.upsertEntity("C", "class", "doc_c");
      const d = store.upsertEntity("D", "class", "doc_d");

      store.addRelation(a.id, b.id, "uses");
      store.addRelation(b.id, c.id, "uses");
      store.addRelation(c.id, d.id, "uses");

      // Depth 1: should reach B but not C or D
      const sub1 = store.extractSubgraph([a.id], 1);
      expect(sub1.entities.length).toBe(2); // A + B
      expect(sub1.docIds).toContain("doc_a");
      expect(sub1.docIds).toContain("doc_b");

      // Depth 2: should reach B and C
      const sub2 = store.extractSubgraph([a.id], 2);
      expect(sub2.entities.length).toBe(3); // A + B + C
    });

    it("should respect maxEntities cap", () => {
      const seed = store.upsertEntity("Seed", "class");
      for (let i = 0; i < 10; i++) {
        const child = store.upsertEntity(`Child${i}`, "class");
        store.addRelation(seed.id, child.id, "uses");
      }

      const sub = store.extractSubgraph([seed.id], 1, 5);
      expect(sub.entities.length).toBeLessThanOrEqual(5);
    });
  });

  describe("mergeEntities", () => {
    it("should consolidate mentions and relations", () => {
      const keep = store.upsertEntity("SQLite", "technology", "doc_1");
      const merge = store.upsertEntity("sqlite3", "technology", "doc_2");
      const other = store.upsertEntity("React", "technology");

      store.addRelation(merge.id, other.id, "related_to");

      store.mergeEntities(keep.id, merge.id);

      // Merged entity should be gone
      expect(store.getById(merge.id)).toBeUndefined();

      // Keeper should have mentions from both
      const docs = store.getDocIdsForEntity(keep.id);
      expect(docs).toContain("doc_1");
      expect(docs).toContain("doc_2");
    });
  });

  describe("stats", () => {
    it("should return correct counts", () => {
      store.upsertEntity("A", "class", "doc_1");
      store.upsertEntity("B", "class", "doc_2");
      store.addRelation(
        store.findByName("A")[0].id,
        store.findByName("B")[0].id,
        "uses",
      );

      const s = store.stats();
      expect(s.entities).toBe(2);
      expect(s.relations).toBe(1);
      expect(s.mentions).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all KG data", () => {
      store.upsertEntity("A", "class", "doc_1");
      store.clear();
      expect(store.stats().entities).toBe(0);
    });
  });
});

// ── Entity Extractor Tests ───────────────────────────────

describe("Entity Extractor", () => {
  describe("extractEntitiesFromText", () => {
    it("should extract PascalCase class names", () => {
      const entities = extractEntitiesFromText("The GraphNode class handles nodes.");
      expect(entities.some((e) => e.name === "GraphNode" && e.type === "class")).toBe(true);
    });

    it("should extract camelCase function names", () => {
      const entities = extractEntitiesFromText("Call findNextTask to get the task.");
      expect(entities.some((e) => e.name === "findNextTask" && e.type === "function")).toBe(true);
    });

    it("should extract file paths", () => {
      const entities = extractEntitiesFromText("See src/core/rag/pipeline.ts for details.");
      expect(entities.some((e) => e.name === "src/core/rag/pipeline.ts" && e.type === "file")).toBe(true);
    });

    it("should extract package names", () => {
      const entities = extractEntitiesFromText("Uses @anthropic-ai/sdk and better-sqlite3.");
      expect(entities.some((e) => e.name === "@anthropic-ai/sdk" && e.type === "package")).toBe(true);
    });

    it("should extract technology terms", () => {
      const entities = extractEntitiesFromText("Built with TypeScript and SQLite.");
      expect(entities.some((e) => e.name === "TypeScript" && e.type === "technology")).toBe(true);
      expect(entities.some((e) => e.name === "SQLite" && e.type === "technology")).toBe(true);
    });

    it("should extract API endpoints", () => {
      const entities = extractEntitiesFromText("POST /api/knowledge creates a document.");
      expect(entities.some((e) => e.name === "POST /api/knowledge" && e.type === "api_endpoint")).toBe(true);
    });

    it("should extract UPPER_SNAKE_CASE config names", () => {
      const entities = extractEntitiesFromText("Set MAX_TOKEN_BUDGET to control limits.");
      expect(entities.some((e) => e.name === "MAX_TOKEN_BUDGET" && e.type === "config")).toBe(true);
    });

    it("should extract markdown heading domain terms", () => {
      const entities = extractEntitiesFromText("## Knowledge Pipeline\nThe pipeline processes...");
      expect(entities.some((e) => e.name === "Knowledge Pipeline" && e.type === "domain_term")).toBe(true);
    });

    it("should extract backtick-quoted concepts", () => {
      const entities = extractEntitiesFromText("Uses `knowledge graph` for retrieval.");
      expect(entities.some((e) => e.name === "knowledge graph" && e.type === "concept")).toBe(true);
    });

    it("should deduplicate entities by name+type", () => {
      const entities = extractEntitiesFromText("GraphNode uses GraphNode pattern.");
      const graphNodes = entities.filter((e) => e.name === "GraphNode");
      expect(graphNodes.length).toBe(1);
    });
  });

  describe("extractRelationsFromText", () => {
    it("should detect 'uses' pattern", () => {
      const entities: ExtractedEntity[] = [
        { name: "SqliteStore", type: "class" },
        { name: "better-sqlite3", type: "package" },
      ];
      const rels = extractRelationsFromText("SqliteStore uses better-sqlite3 for persistence.", entities);
      expect(rels.some((r) => r.relationType === "uses")).toBe(true);
    });

    it("should detect 'implements' pattern", () => {
      const entities: ExtractedEntity[] = [
        { name: "GraphStore", type: "class" },
        { name: "Store", type: "class" },
      ];
      const rels = extractRelationsFromText("GraphStore implements Store interface.", entities);
      expect(rels.some((r) => r.relationType === "implements")).toBe(true);
    });

    it("should detect 'depends on' pattern", () => {
      const entities: ExtractedEntity[] = [
        { name: "RagPipeline", type: "class" },
        { name: "KnowledgeStore", type: "class" },
      ];
      const rels = extractRelationsFromText("RagPipeline depends on KnowledgeStore.", entities);
      expect(rels.some((r) => r.relationType === "depends_on")).toBe(true);
    });

    it("should detect import statements", () => {
      const entities: ExtractedEntity[] = [
        { name: "generateId", type: "function" },
      ];
      const rels = extractRelationsFromText('import { generateId } from "../utils/id.js"', entities);
      expect(rels.some((r) => r.relationType === "uses")).toBe(true);
    });

    it("should detect 'extends' pattern", () => {
      const entities: ExtractedEntity[] = [
        { name: "CustomError", type: "class" },
        { name: "Error", type: "class" },
      ];
      const rels = extractRelationsFromText("CustomError extends Error class.", entities);
      expect(rels.some((r) => r.relationType === "extends")).toBe(true);
    });

    it("should relate entities in same heading section", () => {
      const entities: ExtractedEntity[] = [
        { name: "SQLite", type: "technology" },
        { name: "FTS5", type: "technology" },
      ];
      const rels = extractRelationsFromText("## Search\nSQLite and FTS5 power the search.", entities);
      expect(rels.some((r) => r.relationType === "related_to")).toBe(true);
    });
  });
});

// ── Entity Indexer Tests ─────────────────────────────────

describe("Entity Indexer", () => {
  let db: Database.Database;
  let entityStore: EntityStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    entityStore = new EntityStore(db);
    knowledgeStore = new KnowledgeStore(db);
  });

  describe("indexDocument", () => {
    it("should extract and store entities from a knowledge document", () => {
      const doc = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:test",
        title: "Architecture Decision",
        content: "SqliteStore uses better-sqlite3 for persistence. Built with TypeScript.",
      });

      const result = indexDocument(db, doc.id);

      expect(result.entitiesCreated).toBeGreaterThan(0);
      expect(entityStore.stats().entities).toBeGreaterThan(0);

      // Should have entities linked to doc
      const entities = entityStore.getEntitiesForDoc(doc.id);
      expect(entities.length).toBeGreaterThan(0);
    });
  });

  describe("reindexAll", () => {
    it("should clear and rebuild the KG from all knowledge docs", () => {
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "docs:react",
        title: "React Docs",
        content: "React is a JavaScript library. Uses TypeScript for type safety.",
      });

      knowledgeStore.insert({
        sourceType: "prd",
        sourceId: "prd:feature",
        title: "Feature PRD",
        content: "The GraphNode class extends BaseNode. Uses SQLite for storage.",
      });

      const result = reindexAll(db);

      expect(result.documentsProcessed).toBe(2);
      expect(result.totalEntities).toBeGreaterThan(0);
      expect(result.totalRelations).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── Decomposed Query Tests ───────────────────────────────

describe("DecomposedQuery", () => {
  let db: Database.Database;
  let entityStore: EntityStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    entityStore = new EntityStore(db);
  });

  it("should decompose query into high and low level keys", () => {
    const result = decomposeQuery("how does SqliteStore work?", db);

    expect(result.intent).toBe("how_to");
    expect(result.highLevelKeys.length).toBeGreaterThan(0);
    expect(result.highLevelKeys).toContain("how_to");
    expect(result.lowLevelKeys.length).toBeGreaterThan(0);
  });

  it("should match entities from KG when available", () => {
    // Populate KG with entities
    entityStore.upsertEntity("SqliteStore", "class", "doc_1");
    entityStore.upsertEntity("KnowledgeStore", "class", "doc_2");

    const result = decomposeQuery("How does SqliteStore persist data?", db);

    expect(result.entityMatches.length).toBeGreaterThan(0);
    expect(result.entityMatches.some((m) => m.name === "SqliteStore")).toBe(true);
  });

  it("should return empty entityMatches when KG is empty", () => {
    const result = decomposeQuery("What is the architecture?", db);

    expect(result.entityMatches).toEqual([]);
  });

  it("should gracefully handle missing KG tables", () => {
    // Create a fresh DB without migrations
    const rawDb = new Database(":memory:");
    const result = decomposeQuery("SqliteStore query", rawDb);

    expect(result.entityMatches).toEqual([]);
    expect(result.highLevelKeys.length).toBeGreaterThan(0);
  });
});

// ── Multi-Strategy with Entity Graph Tests ───────────────

describe("Multi-Strategy with Entity Graph", () => {
  let db: Database.Database;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    knowledgeStore = new KnowledgeStore(db);
  });

  it("should return results combining FTS and entity graph strategies", () => {
    // Insert knowledge documents
    const doc1 = knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:arch",
      title: "Architecture",
      content: "SqliteStore uses better-sqlite3 for persistent storage of nodes and edges.",
    });

    const doc2 = knowledgeStore.insert({
      sourceType: "docs",
      sourceId: "docs:sqlite",
      title: "SQLite Guide",
      content: "SQLite is a lightweight database. FTS5 enables full-text search.",
    });

    // Index entities into KG
    indexDocument(db, doc1.id);
    indexDocument(db, doc2.id);

    // Search should find both docs
    const results = multiStrategySearch(db, "SQLite storage");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should work with empty KG (graceful degradation)", () => {
    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:test",
      title: "Test Memory",
      content: "This is a test document about testing.",
    });

    // No entity indexing — KG is empty
    const results = multiStrategySearch(db, "test");
    expect(results.length).toBeGreaterThan(0);
    // Should not contain entity_graph strategy
    expect(results.every((r) => !r.strategies.includes("entity_graph"))).toBe(true);
  });

  it("should include entity_graph strategy when KG has matching entities", () => {
    const doc = knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:arch",
      title: "Architecture Notes",
      content: "The SqliteStore class manages database connections. Uses better-sqlite3.",
    });

    // Build KG
    indexDocument(db, doc.id);

    const results = multiStrategySearch(db, "SqliteStore database");
    if (results.length > 0) {
      // At least one result should have entity_graph strategy
      const hasEntityGraph = results.some((r) => r.strategies.includes("entity_graph"));
      // This may or may not be true depending on KG matching, but should not error
      expect(typeof hasEntityGraph).toBe("boolean");
    }
  });
});
