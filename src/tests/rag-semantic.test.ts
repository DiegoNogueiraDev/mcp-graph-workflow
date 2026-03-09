import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import { indexNodeEmbeddings, semanticSearch, TfIdfVectorizer } from "../core/rag/rag-pipeline.js";
import { makeNode } from "./helpers/factories.js";

describe("RAG Semantic Pipeline", () => {
  let store: SqliteStore;
  let embeddingStore: EmbeddingStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("RAG Semantic Test");
    embeddingStore = new EmbeddingStore(store);
  });

  afterEach(() => {
    store.close();
  });

  // ── TfIdfVectorizer ──────────────────────────

  describe("TfIdfVectorizer", () => {
    it("should build vocabulary from documents", () => {
      const vectorizer = new TfIdfVectorizer();
      vectorizer.fit([["hello", "world"], ["world", "test"]]);

      expect(vectorizer.vocabSize).toBeGreaterThan(0);
    });

    it("should embed text using built vocabulary", () => {
      const vectorizer = new TfIdfVectorizer();
      vectorizer.fit([["parser", "prd", "ast"], ["database", "sqlite"]]);

      const vec = vectorizer.embed("parser prd");
      expect(vec.length).toBe(vectorizer.vocabSize);
      expect(vec.some((v) => v > 0)).toBe(true);
    });

    it("should return hash-based vector when vocabulary not built", () => {
      const vectorizer = new TfIdfVectorizer();
      const vec = vectorizer.embed("some text");

      expect(vec.length).toBe(128);
    });

    it("should isolate state between instances", () => {
      const v1 = new TfIdfVectorizer();
      const v2 = new TfIdfVectorizer();

      v1.fit([["alpha", "beta"]]);
      v2.fit([["gamma", "delta", "epsilon"]]);

      expect(v1.vocabSize).not.toBe(v2.vocabSize);
    });
  });

  // ── indexNodeEmbeddings ────────────────────────

  describe("indexNodeEmbeddings", () => {
    it("should index all nodes from the store", async () => {
      store.insertNode(makeNode({ title: "Implement parser", description: "Parse PRD files into AST" }));
      store.insertNode(makeNode({ title: "Create database", description: "SQLite storage layer" }));

      const count = await indexNodeEmbeddings(store, embeddingStore);

      expect(count).toBe(2);
      expect(embeddingStore.count()).toBe(2);
    });

    it("should use title + description as embedding text", async () => {
      store.insertNode(makeNode({
        id: "node-1",
        title: "Implement parser",
        description: "Parse PRD files into AST",
      }));

      await indexNodeEmbeddings(store, embeddingStore);

      const entry = embeddingStore.getById("node:node-1");
      expect(entry).not.toBeNull();
      expect(entry!.text).toContain("Implement parser");
      expect(entry!.text).toContain("Parse PRD files");
    });

    it("should handle nodes without descriptions", async () => {
      store.insertNode(makeNode({ title: "Simple task" }));

      const count = await indexNodeEmbeddings(store, embeddingStore);
      expect(count).toBe(1);
    });

    it("should skip indexing when no nodes exist", async () => {
      const count = await indexNodeEmbeddings(store, embeddingStore);
      expect(count).toBe(0);
    });
  });

  // ── semanticSearch ────────────────────────────

  describe("semanticSearch", () => {
    beforeEach(async () => {
      store.insertNode(makeNode({
        id: "n1",
        title: "Implement parser module",
        description: "Parse PRD files into structured data using AST",
      }));
      store.insertNode(makeNode({
        id: "n2",
        title: "Create SQLite database",
        description: "Persistent storage layer for graph data",
      }));
      store.insertNode(makeNode({
        id: "n3",
        title: "Build CLI interface",
        description: "Commander.js CLI for user commands",
      }));

      await indexNodeEmbeddings(store, embeddingStore);
    });

    it("should return results for a query", async () => {
      const results = await semanticSearch(embeddingStore, "parsing PRD documents", 3);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("id");
      expect(results[0]).toHaveProperty("text");
      expect(results[0]).toHaveProperty("similarity");
    });

    it("should respect limit parameter", async () => {
      const results = await semanticSearch(embeddingStore, "database storage", 1);
      expect(results).toHaveLength(1);
    });

    it("should return similarity scores between 0 and 1", async () => {
      const results = await semanticSearch(embeddingStore, "parser", 3);

      for (const result of results) {
        expect(result.similarity).toBeGreaterThanOrEqual(-1);
        expect(result.similarity).toBeLessThanOrEqual(1);
      }
    });
  });
});
