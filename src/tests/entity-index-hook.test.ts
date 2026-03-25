import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EntityStore } from "../core/rag/entity-store.js";
import {
  indexEntitiesForDoc,
  indexEntitiesForDocs,
  indexEntitiesForSource,
} from "../core/rag/entity-index-hook.js";

describe("Entity Index Hook", () => {
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

  describe("indexEntitiesForDoc", () => {
    it("should extract entities from a knowledge document", () => {
      const doc = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:arch",
        title: "Architecture",
        content: "SqliteStore uses better-sqlite3 for persistence. Built with TypeScript and React.",
      });

      indexEntitiesForDoc(db, doc.id);

      const stats = entityStore.stats();
      expect(stats.entities).toBeGreaterThan(0);
      expect(stats.mentions).toBeGreaterThan(0);
    });

    it("should not throw if document does not exist", () => {
      expect(() => indexEntitiesForDoc(db, "nonexistent_id")).not.toThrow();
    });

    it("should not throw if KG tables do not exist", () => {
      const rawDb = new Database(":memory:");
      // No migrations — no kg_entities table
      rawDb.exec("CREATE TABLE knowledge_documents (id TEXT PRIMARY KEY, title TEXT, content TEXT)");
      expect(() => indexEntitiesForDoc(rawDb, "some_id")).not.toThrow();
    });
  });

  describe("indexEntitiesForDocs", () => {
    it("should index entities from multiple documents", () => {
      const doc1 = knowledgeStore.insert({
        sourceType: "prd",
        sourceId: "prd:feature",
        title: "Feature PRD",
        content: "GraphNode extends BaseNode. Uses SQLite for storage.",
      });
      const doc2 = knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "docs:react",
        title: "React Docs",
        content: "React is a JavaScript framework with TypeScript support.",
      });

      indexEntitiesForDocs(db, [doc1.id, doc2.id]);

      const stats = entityStore.stats();
      expect(stats.entities).toBeGreaterThan(2);
    });

    it("should not throw on empty array", () => {
      expect(() => indexEntitiesForDocs(db, [])).not.toThrow();
    });

    it("should continue processing if one doc fails", () => {
      const doc = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:test",
        title: "Test",
        content: "SqliteStore uses TypeScript.",
      });

      // Mix valid and invalid doc IDs
      indexEntitiesForDocs(db, ["bad_id", doc.id]);

      expect(entityStore.stats().entities).toBeGreaterThan(0);
    });
  });

  describe("indexEntitiesForSource", () => {
    it("should index all documents of a given source type", () => {
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:arch",
        title: "Architecture",
        content: "Built with TypeScript and SQLite. Uses FTS5 for search.",
      });
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "memory:decisions",
        title: "Decisions",
        content: "Chose React for the dashboard. Commander.js for CLI.",
      });
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "docs:react",
        title: "React Docs",
        content: "React is a library for building user interfaces.",
      });

      indexEntitiesForSource(db, "memory");

      // Should have entities from memory docs
      const stats = entityStore.stats();
      expect(stats.entities).toBeGreaterThan(0);

      // Entities should be linked to memory docs, not docs source
      const allEntities = entityStore.findByName("TypeScript");
      expect(allEntities.length).toBeGreaterThan(0);
    });

    it("should not throw for unknown source type", () => {
      expect(() => indexEntitiesForSource(db, "nonexistent_source")).not.toThrow();
    });
  });
});
