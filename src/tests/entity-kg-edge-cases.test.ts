/**
 * QA Edge Cases — Knowledge Graph entity system
 *
 * Tests for error scenarios, boundary conditions, and data integrity
 * that could cause bugs in production. Focuses on risks identified
 * in the QA audit: FTS5 consistency, JSON parse safety, weight bounds,
 * mention dedup, cycle handling, maxNodes cap, and schema integrity.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { EntityStore } from "../core/rag/entity-store.js";
import { extractEntitiesFromText } from "../core/rag/entity-extractor.js";
import { indexDocument } from "../core/rag/entity-indexer.js";
// KnowledgeStore not needed directly — docs seeded via SQL in these tests

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("Entity KG — Edge Cases", () => {
  let db: Database.Database;
  let store: EntityStore;

  beforeEach(() => {
    db = createDb();
    store = new EntityStore(db);
  });

  // ── FTS5 consistency ─────────────────────────────────────

  describe("FTS5 consistency", () => {
    it("should keep FTS and main table in sync after upsert", () => {
      const entity = store.upsertEntity("GraphNode", "class");

      // Search via FTS should find it
      const ftsResults = store.findByName("GraphNode");
      expect(ftsResults.length).toBeGreaterThanOrEqual(1);
      expect(ftsResults[0].id).toBe(entity.id);
    });

    it("should find entity via FTS prefix search", () => {
      store.upsertEntity("SqliteStore", "class");
      store.upsertEntity("SqliteHelper", "class");

      const results = store.findByName("Sqlite");
      expect(results.length).toBe(2);
    });

    it("should fallback to LIKE when FTS query has special chars", () => {
      store.upsertEntity("my-package", "package");

      // FTS5 may choke on hyphens — should fallback to LIKE
      const results = store.findByName("my-package");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("should return empty for blank query", () => {
      store.upsertEntity("Something", "concept");
      expect(store.findByName("")).toHaveLength(0);
      expect(store.findByName("  ")).toHaveLength(0);
    });
  });

  // ── JSON parse safety ────────────────────────────────────

  describe("JSON parse safety", () => {
    it("should handle corrupted aliases JSON gracefully", () => {
      // Insert entity normally
      const entity = store.upsertEntity("TestEntity", "concept");

      // Corrupt the aliases field directly in DB
      db.prepare("UPDATE kg_entities SET aliases = 'NOT_VALID_JSON' WHERE id = ?").run(entity.id);

      // Reading should throw — this is a known risk
      expect(() => {
        store.getById(entity.id);
      }).toThrow(); // JSON.parse will throw
    });

    it("should handle corrupted metadata JSON gracefully", () => {
      const entity = store.upsertEntity("TestEntity", "concept");

      db.prepare("UPDATE kg_entities SET metadata = '{broken' WHERE id = ?").run(entity.id);

      expect(() => {
        store.getById(entity.id);
      }).toThrow(); // JSON.parse will throw
    });
  });

  // ── Relation weight bounds ───────────────────────────────

  describe("relation weight bounds", () => {
    it("should accept weight=0.0 (minimum valid)", () => {
      const e1 = store.upsertEntity("A", "concept");
      const e2 = store.upsertEntity("B", "concept");

      const rel = store.addRelation(e1.id, e2.id, "related_to", 0.0);
      expect(rel).not.toBeNull();
      expect(rel!.weight).toBe(0.0);
    });

    it("should accept weight=1.0 (maximum valid)", () => {
      const e1 = store.upsertEntity("A", "concept");
      const e2 = store.upsertEntity("B", "concept");

      const rel = store.addRelation(e1.id, e2.id, "uses", 1.0);
      expect(rel).not.toBeNull();
      expect(rel!.weight).toBe(1.0);
    });

    it("should accept negative weight (no validation — known risk)", () => {
      const e1 = store.upsertEntity("A", "concept");
      const e2 = store.upsertEntity("B", "concept");

      // This SHOULD be rejected but currently isn't — documenting behavior
      const rel = store.addRelation(e1.id, e2.id, "related_to", -0.5);
      expect(rel).not.toBeNull();
      expect(rel!.weight).toBe(-0.5);
    });

    it("should accept weight > 1.0 (no validation — known risk)", () => {
      const e1 = store.upsertEntity("A", "concept");
      const e2 = store.upsertEntity("B", "concept");

      const rel = store.addRelation(e1.id, e2.id, "related_to", 2.5);
      expect(rel).not.toBeNull();
      expect(rel!.weight).toBe(2.5);
    });
  });

  // ── Mention dedup ────────────────────────────────────────

  describe("mention dedup behavior", () => {
    it("should allow duplicate mentions (same entity+doc+position) — known risk", () => {
      const entity = store.upsertEntity("TestEntity", "concept");

      store.addMention(entity.id, "doc-1", "context", 0);
      store.addMention(entity.id, "doc-1", "context", 0);
      store.addMention(entity.id, "doc-1", "context", 0);

      const mentions = store.getMentions(entity.id);
      // Current behavior: all 3 are inserted (no dedup)
      expect(mentions).toHaveLength(3);
    });
  });

  // ── Doc não existe ───────────────────────────────────────

  describe("indexDocument with non-existent doc", () => {
    it("should return zero entities for non-existent docId", () => {
      const result = indexDocument(db, "nonexistent_doc_12345");

      expect(result.entitiesCreated).toBe(0);
      expect(result.relationsCreated).toBe(0);
    });
  });

  // ── KG tables ausentes ───────────────────────────────────

  describe("graceful degradation without KG tables", () => {
    it("should return false for hasKgTables on fresh DB without migration 12", () => {
      const freshDb = new Database(":memory:");
      configureDb(freshDb);
      // Run only first 11 migrations
      // Actually we can just check if a store without KG tables works
      freshDb.exec("CREATE TABLE IF NOT EXISTS test (id TEXT)");

      const freshStore = new EntityStore(freshDb);
      expect(freshStore.hasKgTables()).toBe(false);

      freshDb.close();
    });
  });

  // ── Entity extraction edge cases ─────────────────────────

  describe("extractEntitiesFromText edge cases", () => {
    it("should return empty for empty string", () => {
      const entities = extractEntitiesFromText("");
      expect(entities).toHaveLength(0);
    });

    it("should return empty for only stopwords", () => {
      const entities = extractEntitiesFromText("the a an is are was were");
      expect(entities).toHaveLength(0);
    });

    it("should handle very long input without crashing", () => {
      const longText = "SqliteStore ".repeat(10000);
      const entities = extractEntitiesFromText(longText);
      // Should complete without timeout/crash
      expect(entities.length).toBeGreaterThan(0);
    });

    it("should handle entity names with special characters", () => {
      const entities = extractEntitiesFromText("The `hello-world` package is used");
      expect(entities.some((e) => e.name.includes("hello-world"))).toBe(true);
    });

    it("should extract API endpoints correctly", () => {
      const entities = extractEntitiesFromText("The endpoint GET /api/v1/nodes returns all nodes");
      expect(entities.some((e) => e.type === "api_endpoint")).toBe(true);
    });

    it("should skip TODO/FIXME in UPPER_SNAKE detection", () => {
      const entities = extractEntitiesFromText("TODO: fix this. FIXME: later. HACK: workaround");
      const upperSnake = entities.filter((e) => e.type === "config");
      // TODO, FIXME, HACK should not be detected as config constants
      expect(upperSnake.every((e) => !["TODO", "FIXME", "HACK"].includes(e.name))).toBe(true);
    });
  });

  // ── Subgraph with cycles ─────────────────────────────────

  describe("BFS subgraph with cycles", () => {
    it("should not loop infinitely on cyclic relations", () => {
      const a = store.upsertEntity("A", "concept");
      const b = store.upsertEntity("B", "concept");
      const c = store.upsertEntity("C", "concept");

      store.addRelation(a.id, b.id, "uses");
      store.addRelation(b.id, c.id, "uses");
      store.addRelation(c.id, a.id, "uses"); // cycle

      const subgraph = store.extractSubgraph([a.id], 5, 50);

      expect(subgraph.entities).toHaveLength(3);
      expect(subgraph.relations.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle self-referencing relation", () => {
      const a = store.upsertEntity("SelfRef", "concept");
      store.addRelation(a.id, a.id, "related_to");

      const subgraph = store.extractSubgraph([a.id], 3, 50);
      expect(subgraph.entities).toHaveLength(1);
    });
  });

  // ── maxNodes cap ─────────────────────────────────────────

  describe("extractSubgraph maxNodes cap", () => {
    it("should respect maxEntities limit", () => {
      // Create a chain of 20 entities
      const entities = [];
      for (let i = 0; i < 20; i++) {
        entities.push(store.upsertEntity(`Entity${i}`, "concept"));
      }
      for (let i = 0; i < 19; i++) {
        store.addRelation(entities[i].id, entities[i + 1].id, "uses");
      }

      const subgraph = store.extractSubgraph([entities[0].id], 20, 5);

      expect(subgraph.entities.length).toBeLessThanOrEqual(5);
    });
  });

  // ── Schema integrity (SQLite direct) ─────────────────────

  describe("schema integrity", () => {
    it("should create all KG tables in migration 12", () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'kg_%'")
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name).sort();
      expect(tableNames).toContain("kg_entities");
      expect(tableNames).toContain("kg_mentions");
      expect(tableNames).toContain("kg_relations");
    });

    it("should create FTS5 virtual table", () => {
      const fts = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'kg_entities_fts'")
        .get() as { name: string } | undefined;
      expect(fts).toBeTruthy();
    });

    it("should enforce UNIQUE constraint on relations", () => {
      const e1 = store.upsertEntity("X", "concept");
      const e2 = store.upsertEntity("Y", "concept");

      store.addRelation(e1.id, e2.id, "uses", 0.8);
      store.addRelation(e1.id, e2.id, "uses", 0.9);

      // Second insert should be ignored (INSERT OR IGNORE)
      // The function returns null on duplicate
      // But actually it returns the new relation object even on IGNORE — let's check
      // Count relations in DB
      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM kg_relations WHERE from_entity_id = ? AND to_entity_id = ? AND relation_type = ?")
        .get(e1.id, e2.id, "uses") as { cnt: number };
      expect(count.cnt).toBe(1);
    });

    it("should create indexes on KG tables", () => {
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_kg_%'")
        .all() as Array<{ name: string }>;

      expect(indexes.length).toBeGreaterThanOrEqual(3); // type, normalized_name, entity_id, doc_id, relation
    });
  });

  // ── FTS5 search at scale ─────────────────────────────────

  describe("FTS5 search at scale", () => {
    it("should handle 100 entities and return ranked results", () => {
      for (let i = 0; i < 100; i++) {
        store.upsertEntity(`Entity${i}Concept`, "concept");
      }

      const results = store.findByName("Entity5");
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Should find Entity5, Entity50-59
      expect(results.some((r) => r.name.startsWith("Entity5"))).toBe(true);
    });
  });

  // ── Upsert dedup ─────────────────────────────────────────

  describe("upsert dedup behavior", () => {
    it("should increment mention_count on duplicate upsert", () => {
      const first = store.upsertEntity("SqliteStore", "class");
      expect(first.mentionCount).toBe(1);

      const second = store.upsertEntity("SqliteStore", "class");
      expect(second.mentionCount).toBe(2);

      const third = store.upsertEntity("SqliteStore", "class");
      expect(third.mentionCount).toBe(3);
    });

    it("should treat same name but different type as different entities", () => {
      const cls = store.upsertEntity("Store", "class");
      const concept = store.upsertEntity("Store", "concept");

      expect(cls.id).not.toBe(concept.id);
    });

    it("should normalize name case for dedup", () => {
      const upper = store.upsertEntity("SQLITESTORE", "class");
      const lower = store.upsertEntity("sqlitestore", "class");

      // Same normalized_name → should be same entity (mention_count=2)
      expect(upper.id).toBe(lower.id);
      expect(lower.mentionCount).toBe(2);
    });
  });
});
