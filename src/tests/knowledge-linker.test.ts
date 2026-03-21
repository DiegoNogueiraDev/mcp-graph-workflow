import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { linkBySharedContext, findCrossSourceContext } from "../core/rag/knowledge-linker.js";

describe("Knowledge Linker", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  describe("linkBySharedContext", () => {
    it("should link docs that share the same nodeId in metadata", () => {
      store.insert({
        sourceType: "memory",
        sourceId: "mem:auth",
        title: "Auth memory",
        content: "We decided to use JWT for authentication",
        metadata: { nodeId: "node_auth" },
      });
      store.insert({
        sourceType: "ai_decision",
        sourceId: "decision:auth",
        title: "Auth decision",
        content: "Used jsonwebtoken with RS256",
        metadata: { nodeId: "node_auth" },
      });
      store.insert({
        sourceType: "validation_result",
        sourceId: "val:auth",
        title: "Auth validation",
        content: "All AC passed for auth",
        metadata: { nodeId: "node_auth" },
      });

      const result = linkBySharedContext(db);
      expect(result.relationsCreated).toBeGreaterThanOrEqual(2);

      // Verify relations exist
      const relations = db
        .prepare("SELECT * FROM knowledge_relations")
        .all();
      expect(relations.length).toBeGreaterThanOrEqual(2);
    });

    it("should link docs that share tags", () => {
      store.insert({
        sourceType: "memory",
        sourceId: "mem:1",
        title: "Memory with tags",
        content: "Authentication patterns",
        metadata: { tags: ["auth", "security"] },
      });
      store.insert({
        sourceType: "docs",
        sourceId: "docs:1",
        title: "Docs with tags",
        content: "Security documentation",
        metadata: { tags: ["security", "encryption"] },
      });

      const result = linkBySharedContext(db);
      expect(result.relationsCreated).toBeGreaterThanOrEqual(1);
    });

    it("should not create duplicate relations", () => {
      store.insert({
        sourceType: "memory",
        sourceId: "mem:x",
        title: "Doc A",
        content: "Content A",
        metadata: { nodeId: "node_x" },
      });
      store.insert({
        sourceType: "ai_decision",
        sourceId: "dec:x",
        title: "Doc B",
        content: "Content B",
        metadata: { nodeId: "node_x" },
      });

      linkBySharedContext(db);
      const firstCount = (db.prepare("SELECT COUNT(*) as cnt FROM knowledge_relations").get() as { cnt: number }).cnt;

      // Run again — should not create duplicates
      linkBySharedContext(db);
      const secondCount = (db.prepare("SELECT COUNT(*) as cnt FROM knowledge_relations").get() as { cnt: number }).cnt;

      expect(secondCount).toBe(firstCount);
    });

    it("should return zero relations when no shared context exists", () => {
      store.insert({
        sourceType: "memory",
        sourceId: "mem:alone",
        title: "Isolated doc",
        content: "No shared context",
      });

      const result = linkBySharedContext(db);
      expect(result.relationsCreated).toBe(0);
    });
  });

  describe("findCrossSourceContext", () => {
    it("should find related docs from different sources", () => {
      const docA = store.insert({
        sourceType: "memory",
        sourceId: "mem:cross1",
        title: "Memory",
        content: "Cross source test A",
        metadata: { nodeId: "node_cross" },
      });
      store.insert({
        sourceType: "ai_decision",
        sourceId: "dec:cross1",
        title: "Decision",
        content: "Cross source test B",
        metadata: { nodeId: "node_cross" },
      });

      linkBySharedContext(db);

      const related = findCrossSourceContext(db, docA.id);
      expect(related.length).toBeGreaterThan(0);
      expect(related[0].sourceType).not.toBe(docA.sourceType);
    });

    it("should return empty array when no relations exist", () => {
      const doc = store.insert({
        sourceType: "memory",
        sourceId: "mem:lonely",
        title: "Lonely doc",
        content: "No relations",
      });

      const related = findCrossSourceContext(db, doc.id);
      expect(related).toHaveLength(0);
    });
  });
});
