import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import { indexAllEmbeddings } from "../core/rag/rag-pipeline.js";
import { queryMemories } from "../core/rag/memory-rag-query.js";

describe("MemoryRagQuery", () => {
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

  it("should return empty results when no memories exist", async () => {
    const results = await queryMemories(store, "architecture");
    expect(results.results).toHaveLength(0);
    expect(results.query).toBe("architecture");
    expect(results.totalMemoryDocuments).toBe(0);
  });

  it("should find memories by FTS keyword search", async () => {
    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:architecture/overview",
      title: "architecture/overview",
      content: "TypeScript project using SQLite for persistence with FTS5 full-text search",
    });

    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:testing/patterns",
      title: "testing/patterns",
      content: "Vitest framework with TDD approach and in-memory SQLite databases",
    });

    const results = await queryMemories(store, "SQLite persistence");

    expect(results.results.length).toBeGreaterThanOrEqual(1);
    expect(results.results[0].title).toContain("architecture");
    expect(results.totalMemoryDocuments).toBe(2);
  });

  it("should also find legacy serena-sourced memories", async () => {
    // Legacy serena doc
    knowledgeStore.insert({
      sourceType: "serena",
      sourceId: "serena:old-memory",
      title: "old-memory",
      content: "Legacy Serena memory about database patterns",
    });

    // New memory doc
    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:new-memory",
      title: "new-memory",
      content: "New native memory about database patterns",
    });

    const results = await queryMemories(store, "database patterns");

    expect(results.results.length).toBeGreaterThanOrEqual(1);
    expect(results.totalMemoryDocuments).toBe(2);
  });

  it("should find memories by semantic similarity", async () => {
    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:architecture/overview",
      title: "architecture/overview",
      content: "MCP graph workflow system with SQLite store and event-driven integrations",
    });

    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:conventions/rules",
      title: "conventions/rules",
      content: "Strict TypeScript with Zod validation and ESM module imports",
    });

    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:mcp-tools/catalog",
      title: "mcp-tools/catalog",
      content: "27 MCP tools for graph management including import export search and planning",
    });

    await indexAllEmbeddings(store, embeddingStore);

    const results = await queryMemories(store, "MCP tools planning", {
      mode: "semantic",
      limit: 3,
    });

    expect(results.results.length).toBeGreaterThanOrEqual(1);
    expect(results.mode).toBe("semantic");
  });

  it("should support hybrid mode combining FTS and semantic", async () => {
    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:roadmap/status",
      title: "roadmap/status",
      content: "All seven phases completed with knowledge store and tiered compression",
    });

    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "memory:testing/patterns",
      title: "testing/patterns",
      content: "599 tests passing with Vitest including unit and integration coverage",
    });

    await indexAllEmbeddings(store, embeddingStore);

    const results = await queryMemories(store, "testing coverage", {
      mode: "hybrid",
      limit: 5,
    });

    expect(results.results.length).toBeGreaterThanOrEqual(1);
    expect(results.mode).toBe("hybrid");
  });

  it("should respect limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: `memory:topic/memory-${i}`,
        title: `topic/memory-${i}`,
        content: `Memory content number ${i} about software architecture patterns`,
      });
    }

    const results = await queryMemories(store, "architecture", { limit: 2 });
    expect(results.results.length).toBeLessThanOrEqual(2);
  });
});
