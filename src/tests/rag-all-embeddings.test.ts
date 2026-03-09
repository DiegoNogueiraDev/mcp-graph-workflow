import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexAllEmbeddings, semanticSearch } from "../core/rag/rag-pipeline.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeNode(overrides?: Partial<GraphNode>): GraphNode {
  const ts = now();
  return {
    id: generateId("node"),
    type: "task",
    title: "Default task",
    status: "backlog",
    priority: 3,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe("indexAllEmbeddings", () => {
  let store: SqliteStore;
  let embeddingStore: EmbeddingStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    embeddingStore = new EmbeddingStore(store);
  });

  afterEach(() => {
    store.close();
  });

  it("should return zeros when no documents exist", async () => {
    const result = await indexAllEmbeddings(store, embeddingStore);
    expect(result.nodes).toBe(0);
    expect(result.knowledge).toBe(0);
  });

  it("should index only nodes when no knowledge docs exist", async () => {
    store.insertNode(makeNode({ title: "Setup database" }));
    store.insertNode(makeNode({ title: "Build API endpoints" }));

    const result = await indexAllEmbeddings(store, embeddingStore);

    expect(result.nodes).toBe(2);
    expect(result.knowledge).toBe(0);
    expect(embeddingStore.count()).toBe(2);
  });

  it("should index only knowledge docs when no nodes exist", async () => {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "upload",
      sourceId: "f1",
      title: "API Guide",
      content: "REST API design patterns",
    });

    const result = await indexAllEmbeddings(store, embeddingStore);

    expect(result.nodes).toBe(0);
    expect(result.knowledge).toBe(1);
    expect(embeddingStore.count()).toBe(1);
  });

  it("should index both nodes and knowledge docs with unified vocabulary", async () => {
    store.insertNode(makeNode({ title: "Implement REST API", description: "Build the API layer" }));
    store.insertNode(makeNode({ title: "Setup database", description: "Configure SQLite" }));

    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "docs",
      sourceId: "express-docs",
      title: "Express Guide",
      content: "Express is a web framework for building REST APIs",
    });
    knowledgeStore.insert({
      sourceType: "upload",
      sourceId: "patterns",
      title: "Database Patterns",
      content: "SQLite optimization techniques",
    });

    const result = await indexAllEmbeddings(store, embeddingStore);

    expect(result.nodes).toBe(2);
    expect(result.knowledge).toBe(2);
    expect(embeddingStore.count()).toBe(4);
  });

  it("should enable cross-source semantic search", async () => {
    store.insertNode(makeNode({ title: "Build REST endpoints", description: "Express routes for API" }));

    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "docs",
      sourceId: "express-docs",
      title: "Express Documentation",
      content: "Express routing and middleware for REST APIs",
    });

    await indexAllEmbeddings(store, embeddingStore);

    const results = await semanticSearch(embeddingStore, "REST API Express", 10);

    expect(results.length).toBe(2);
    // Both node and knowledge should be found
    const sources = results.map((r) => r.source);
    expect(sources).toContain("node");
    expect(sources).toContain("knowledge");
  });
});
