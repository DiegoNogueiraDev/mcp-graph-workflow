import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexMemories } from "../core/rag/memory-indexer.js";

// Mock the memory-reader module
vi.mock("../core/memory/memory-reader.js", () => ({
  readAllMemories: vi.fn(),
}));

import { readAllMemories } from "../core/memory/memory-reader.js";
const mockReadAll = vi.mocked(readAllMemories);

describe("MemoryIndexer", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
    vi.restoreAllMocks();
  });

  it("should return zeros when no memories found", async () => {
    mockReadAll.mockResolvedValue([]);

    const result = await indexMemories(knowledgeStore, "/fake/path");

    expect(result.memoriesFound).toBe(0);
    expect(result.documentsIndexed).toBe(0);
    expect(knowledgeStore.count()).toBe(0);
  });

  it("should index memories as knowledge documents with sourceType 'memory'", async () => {
    mockReadAll.mockResolvedValue([
      { name: "architecture", content: "The system uses SQLite for storage.", sizeBytes: 36 },
      { name: "conventions", content: "We use TypeScript strict mode.", sizeBytes: 30 },
    ]);

    const result = await indexMemories(knowledgeStore, "/project");

    expect(result.memoriesFound).toBe(2);
    expect(result.documentsIndexed).toBeGreaterThanOrEqual(2);
    expect(knowledgeStore.count("memory")).toBeGreaterThanOrEqual(2);

    // Verify content is searchable
    const docs = knowledgeStore.list({ sourceType: "memory" });
    expect(docs.length).toBeGreaterThanOrEqual(2);
    expect(docs.some((d) => d.content.includes("SQLite"))).toBe(true);
  });

  it("should chunk large memories", async () => {
    const longContent = "This is an important memory. ".repeat(200);
    mockReadAll.mockResolvedValue([
      { name: "big-memory", content: longContent, sizeBytes: Buffer.byteLength(longContent) },
    ]);

    const result = await indexMemories(knowledgeStore, "/project");

    expect(result.memoriesFound).toBe(1);
    expect(knowledgeStore.count("memory")).toBeGreaterThan(1);
  });

  it("should deduplicate identical content on re-index", async () => {
    const memories = [
      { name: "patterns", content: "We follow TDD methodology.", sizeBytes: 26 },
    ];
    mockReadAll.mockResolvedValue(memories);

    await indexMemories(knowledgeStore, "/project");
    const countAfterFirst = knowledgeStore.count("memory");

    await indexMemories(knowledgeStore, "/project");
    const countAfterSecond = knowledgeStore.count("memory");

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it("should store metadata with memory name", async () => {
    mockReadAll.mockResolvedValue([
      { name: "stack-info", content: "Node.js TypeScript Express", sizeBytes: 27 },
    ]);

    await indexMemories(knowledgeStore, "/project");

    const docs = knowledgeStore.list({ sourceType: "memory" });
    expect(docs[0].metadata).toBeDefined();
    expect(docs[0].metadata?.memoryName).toBe("stack-info");
  });
});
