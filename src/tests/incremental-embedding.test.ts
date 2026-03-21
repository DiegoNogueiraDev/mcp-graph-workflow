import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import { indexAllEmbeddings, incrementalIndex } from "../core/rag/rag-pipeline.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Incremental Embedding Updates", () => {
  let store: SqliteStore;
  let embeddingStore: EmbeddingStore;
  let knowledgeStore: KnowledgeStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "incr-embed-"));
    const dbPath = path.join(tmpDir, "test.db");
    store = SqliteStore.openDb(dbPath);
    // Initialize the project so getAllNodes() works
    store.initProject("test-project");
    embeddingStore = new EmbeddingStore(store);
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  it("should do full index when no vocabulary exists", async () => {
    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "mem:1",
      title: "Memory 1",
      content: "First memory about authentication patterns",
    });
    knowledgeStore.insert({
      sourceType: "docs",
      sourceId: "docs:1",
      title: "Docs 1",
      content: "Documentation about database connection pooling",
    });

    const result = await incrementalIndex(store, embeddingStore, ["mem:1", "docs:1"]);
    expect(result.indexed).toBeGreaterThan(0);
    expect(embeddingStore.count()).toBeGreaterThan(0);
  });

  it("should index only new docs when vocabulary exists", async () => {
    // Initial full index
    knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "mem:a",
      title: "Existing Memory",
      content: "Existing content about system architecture",
    });
    await indexAllEmbeddings(store, embeddingStore);
    const initialCount = embeddingStore.count();

    // Add new doc
    const newDoc = knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "mem:b",
      title: "New Memory",
      content: "New content about deployment strategies",
    });

    const result = await incrementalIndex(store, embeddingStore, [newDoc.id]);
    expect(result.indexed).toBe(1);
    expect(embeddingStore.count()).toBeGreaterThan(initialCount);
  });

  it("should handle empty docIds gracefully", async () => {
    const result = await incrementalIndex(store, embeddingStore, []);
    expect(result.indexed).toBe(0);
  });

  it("should skip non-existent docIds", async () => {
    const result = await incrementalIndex(store, embeddingStore, ["nonexistent_id"]);
    expect(result.indexed).toBe(0);
  });
});
