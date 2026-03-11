import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import { indexAllEmbeddings } from "../core/rag/rag-pipeline.js";
import { querySerenaMemories } from "../core/rag/serena-rag-query.js";

describe("SerenaRagQuery", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;
  let embeddingStore: EmbeddingStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
    embeddingStore = new EmbeddingStore(store);
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty results when no serena memories exist", async () => {
    const results = await querySerenaMemories(store, "architecture");
    expect(results.results).toHaveLength(0);
    expect(results.query).toBe("architecture");
    expect(results.totalSerenaDocuments).toBe(0);
  });

  it("should find serena memories by FTS keyword search", async () => {
    // Insert serena knowledge docs directly
    knowledgeStore.insert({
      sourceType: "serena",
      sourceId: "serena:architecture/overview",
      title: "architecture/overview",
      content: "TypeScript project using SQLite for persistence with FTS5 full-text search",
    });

    knowledgeStore.insert({
      sourceType: "serena",
      sourceId: "serena:testing/patterns",
      title: "testing/patterns",
      content: "Vitest framework with TDD approach and in-memory SQLite databases",
    });

    const results = await querySerenaMemories(store, "SQLite persistence");

    expect(results.results.length).toBeGreaterThanOrEqual(1);
    expect(results.results[0].title).toContain("architecture");
    expect(results.totalSerenaDocuments).toBe(2);
  });

  it("should find serena memories by semantic similarity", async () => {
    // Insert multiple knowledge docs to build vocabulary
    knowledgeStore.insert({
      sourceType: "serena",
      sourceId: "serena:architecture/overview",
      title: "architecture/overview",
      content: "MCP graph workflow system with SQLite store and event-driven integrations",
    });

    knowledgeStore.insert({
      sourceType: "serena",
      sourceId: "serena:conventions/rules",
      title: "conventions/rules",
      content: "Strict TypeScript with Zod validation and ESM module imports",
    });

    knowledgeStore.insert({
      sourceType: "serena",
      sourceId: "serena:mcp-tools/catalog",
      title: "mcp-tools/catalog",
      content: "27 MCP tools for graph management including import export search and planning",
    });

    // Index embeddings for semantic search
    await indexAllEmbeddings(store, embeddingStore);

    const results = await querySerenaMemories(store, "MCP tools planning", {
      mode: "semantic",
      limit: 3,
    });

    expect(results.results.length).toBeGreaterThanOrEqual(1);
    expect(results.mode).toBe("semantic");
  });

  it("should support hybrid mode combining FTS and semantic", async () => {
    knowledgeStore.insert({
      sourceType: "serena",
      sourceId: "serena:roadmap/status",
      title: "roadmap/status",
      content: "All seven phases completed with knowledge store and tiered compression",
    });

    knowledgeStore.insert({
      sourceType: "serena",
      sourceId: "serena:testing/patterns",
      title: "testing/patterns",
      content: "599 tests passing with Vitest including unit and integration coverage",
    });

    await indexAllEmbeddings(store, embeddingStore);

    const results = await querySerenaMemories(store, "testing coverage", {
      mode: "hybrid",
      limit: 5,
    });

    expect(results.results.length).toBeGreaterThanOrEqual(1);
    expect(results.mode).toBe("hybrid");
  });

  it("should respect limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      knowledgeStore.insert({
        sourceType: "serena",
        sourceId: `serena:topic/memory-${i}`,
        title: `topic/memory-${i}`,
        content: `Memory content number ${i} about software architecture patterns`,
      });
    }

    const results = await querySerenaMemories(store, "architecture", { limit: 2 });
    expect(results.results.length).toBeLessThanOrEqual(2);
  });
});
