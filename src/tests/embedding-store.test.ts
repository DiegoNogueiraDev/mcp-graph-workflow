import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  EmbeddingStore,
  type EmbeddingEntry,
} from "../core/rag/embedding-store.js";

describe("EmbeddingStore", () => {
  let sqliteStore: SqliteStore;
  let embeddingStore: EmbeddingStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Embedding Test");
    embeddingStore = new EmbeddingStore(sqliteStore);
  });

  afterEach(() => {
    sqliteStore.close();
  });

  // ── Storage ───────────────────────────────────

  describe("upsert and retrieve", () => {
    it("should store and retrieve an embedding by id", () => {
      const entry: EmbeddingEntry = {
        id: "doc-1",
        source: "node",
        sourceId: "node-abc",
        text: "Implement parser module",
        embedding: [0.1, 0.2, 0.3, 0.4],
      };

      embeddingStore.upsert(entry);
      const result = embeddingStore.getById("doc-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("doc-1");
      expect(result!.text).toBe("Implement parser module");
      expect(result!.embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
    });

    it("should return null for non-existent id", () => {
      const result = embeddingStore.getById("nonexistent");
      expect(result).toBeNull();
    });

    it("should update embedding on duplicate id", () => {
      embeddingStore.upsert({
        id: "doc-1",
        source: "node",
        sourceId: "node-abc",
        text: "Original text",
        embedding: [0.1, 0.2],
      });

      embeddingStore.upsert({
        id: "doc-1",
        source: "node",
        sourceId: "node-abc",
        text: "Updated text",
        embedding: [0.3, 0.4],
      });

      const result = embeddingStore.getById("doc-1");
      expect(result!.text).toBe("Updated text");
      expect(result!.embedding).toEqual([0.3, 0.4]);
    });
  });

  // ── Similarity search ─────────────────────────

  describe("findSimilar", () => {
    beforeEach(() => {
      // Store some embeddings with known vectors
      embeddingStore.upsert({
        id: "a",
        source: "node",
        sourceId: "n1",
        text: "Parser module implementation",
        embedding: [1, 0, 0, 0],
      });
      embeddingStore.upsert({
        id: "b",
        source: "node",
        sourceId: "n2",
        text: "Database storage layer",
        embedding: [0, 1, 0, 0],
      });
      embeddingStore.upsert({
        id: "c",
        source: "node",
        sourceId: "n3",
        text: "Parser utility functions",
        embedding: [0.9, 0.1, 0, 0],
      });
    });

    it("should return results sorted by similarity (cosine)", () => {
      // Query vector close to 'a' and 'c' (parser-related)
      const results = embeddingStore.findSimilar([1, 0, 0, 0], 3);

      expect(results.length).toBe(3);
      // 'a' should be most similar (exact match)
      expect(results[0].id).toBe("a");
      expect(results[0].similarity).toBeCloseTo(1.0, 2);
      // 'c' should be second (0.9 alignment)
      expect(results[1].id).toBe("c");
      // 'b' should be least similar (orthogonal)
      expect(results[2].id).toBe("b");
    });

    it("should respect limit parameter", () => {
      const results = embeddingStore.findSimilar([1, 0, 0, 0], 1);
      expect(results).toHaveLength(1);
    });

    it("should return empty array when no embeddings exist", () => {
      const emptyStore = new EmbeddingStore(SqliteStore.open(":memory:"));
      const results = emptyStore.findSimilar([1, 0, 0, 0], 5);
      expect(results).toHaveLength(0);
    });

    it("should include text and source info in results", () => {
      const results = embeddingStore.findSimilar([1, 0, 0, 0], 1);

      expect(results[0]).toHaveProperty("id");
      expect(results[0]).toHaveProperty("text");
      expect(results[0]).toHaveProperty("source");
      expect(results[0]).toHaveProperty("sourceId");
      expect(results[0]).toHaveProperty("similarity");
    });
  });

  // ── Bulk operations ───────────────────────────

  describe("bulk operations", () => {
    it("should count stored embeddings", () => {
      expect(embeddingStore.count()).toBe(0);

      embeddingStore.upsert({
        id: "a", source: "node", sourceId: "n1",
        text: "text", embedding: [1, 0],
      });
      embeddingStore.upsert({
        id: "b", source: "node", sourceId: "n2",
        text: "text", embedding: [0, 1],
      });

      expect(embeddingStore.count()).toBe(2);
    });

    it("should delete embedding by id", () => {
      embeddingStore.upsert({
        id: "a", source: "node", sourceId: "n1",
        text: "text", embedding: [1, 0],
      });

      embeddingStore.delete("a");
      expect(embeddingStore.getById("a")).toBeNull();
      expect(embeddingStore.count()).toBe(0);
    });

    it("should clear all embeddings", () => {
      embeddingStore.upsert({
        id: "a", source: "node", sourceId: "n1",
        text: "text", embedding: [1, 0],
      });
      embeddingStore.upsert({
        id: "b", source: "node", sourceId: "n2",
        text: "text", embedding: [0, 1],
      });

      embeddingStore.clear();
      expect(embeddingStore.count()).toBe(0);
    });
  });
});
