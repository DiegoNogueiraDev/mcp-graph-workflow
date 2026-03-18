import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore, contentHash } from "../core/store/knowledge-store.js";

describe("KnowledgeStore", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Test Project");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  // ── Insert & Retrieve ──────────────────────────

  describe("insert and retrieve", () => {
    it("should insert and retrieve a knowledge document", () => {
      const doc = knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "file-001",
        title: "API Design Guide",
        content: "REST API best practices for Node.js applications",
      });

      expect(doc.id).toMatch(/^kdoc_/);
      expect(doc.sourceType).toBe("upload");
      expect(doc.sourceId).toBe("file-001");
      expect(doc.title).toBe("API Design Guide");
      expect(doc.content).toContain("REST API");
      expect(doc.contentHash).toBeTruthy();
      expect(doc.chunkIndex).toBe(0);
      expect(doc.createdAt).toBeTruthy();
      expect(doc.updatedAt).toBeTruthy();
    });

    it("should retrieve a document by ID", () => {
      const inserted = knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "express/express",
        title: "Express Docs",
        content: "Express is a web framework",
      });

      const retrieved = knowledgeStore.getById(inserted.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(inserted.id);
      expect(retrieved!.title).toBe("Express Docs");
    });

    it("should return null for non-existent ID", () => {
      const result = knowledgeStore.getById("kdoc_nonexistent");
      expect(result).toBeNull();
    });

    it("should store metadata as JSON", () => {
      const doc = knowledgeStore.insert({
        sourceType: "web_capture",
        sourceId: "url-001",
        title: "Captured Page",
        content: "Page content here",
        metadata: { url: "https://example.com", capturedAt: "2024-01-01" },
      });

      expect(doc.metadata).toEqual({ url: "https://example.com", capturedAt: "2024-01-01" });
    });

    it("should store chunk index", () => {
      const doc = knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "file-002",
        title: "Long Doc - Chunk 3",
        content: "Third chunk of a large document",
        chunkIndex: 3,
      });

      expect(doc.chunkIndex).toBe(3);
    });

    it("should insert and retrieve a document with sourceType 'memory'", () => {
      const doc = knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "mem-001",
        title: "Project Architecture Decision",
        content: "We chose SQLite for local-first persistence",
      });

      expect(doc.id).toMatch(/^kdoc_/);
      expect(doc.sourceType).toBe("memory");
      expect(doc.sourceId).toBe("mem-001");
      expect(doc.title).toBe("Project Architecture Decision");

      const retrieved = knowledgeStore.getById(doc.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.sourceType).toBe("memory");
    });
  });

  // ── Deduplication ──────────────────────────────

  describe("deduplication", () => {
    it("should deduplicate by content hash + source ID", () => {
      const doc1 = knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "file-001",
        title: "Guide",
        content: "Exact same content",
      });

      const doc2 = knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "file-001",
        title: "Guide v2",
        content: "Exact same content",
      });

      expect(doc1.id).toBe(doc2.id);
      expect(knowledgeStore.count()).toBe(1);
    });

    it("should allow same content from different sources", () => {
      knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "file-001",
        title: "Guide",
        content: "Same content different source",
      });

      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "lib-001",
        title: "Guide",
        content: "Same content different source",
      });

      expect(knowledgeStore.count()).toBe(2);
    });

    it("should detect existing content by hash", () => {
      const content = "Test content for hash check";
      knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "file-001",
        title: "Test",
        content,
      });

      expect(knowledgeStore.existsByHash(contentHash(content))).toBe(true);
      expect(knowledgeStore.existsByHash(contentHash("different content"))).toBe(false);
    });
  });

  // ── List & Filter ──────────────────────────────

  describe("list and filter", () => {
    beforeEach(() => {
      knowledgeStore.insert({ sourceType: "upload", sourceId: "f1", title: "Upload 1", content: "Upload content 1" });
      knowledgeStore.insert({ sourceType: "upload", sourceId: "f2", title: "Upload 2", content: "Upload content 2" });
      knowledgeStore.insert({ sourceType: "docs", sourceId: "d1", title: "Doc 1", content: "Doc content 1" });
      knowledgeStore.insert({ sourceType: "serena", sourceId: "s1", title: "Memory 1", content: "Memory content 1" });
    });

    it("should list all documents", () => {
      const docs = knowledgeStore.list();
      expect(docs).toHaveLength(4);
    });

    it("should filter by source type", () => {
      const uploads = knowledgeStore.list({ sourceType: "upload" });
      expect(uploads).toHaveLength(2);
      expect(uploads.every((d) => d.sourceType === "upload")).toBe(true);
    });

    it("should respect limit parameter", () => {
      const docs = knowledgeStore.list({ limit: 2 });
      expect(docs).toHaveLength(2);
    });

    it("should respect offset parameter", () => {
      const all = knowledgeStore.list();
      const offset = knowledgeStore.list({ offset: 2 });
      expect(offset).toHaveLength(2);
      expect(offset[0].id).toBe(all[2].id);
    });
  });

  // ── FTS Search ─────────────────────────────────

  describe("FTS search", () => {
    beforeEach(() => {
      knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "f1",
        title: "REST API Guide",
        content: "Building RESTful APIs with Express and Node.js",
      });
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "d1",
        title: "GraphQL Tutorial",
        content: "Introduction to GraphQL schema design",
      });
      knowledgeStore.insert({
        sourceType: "serena",
        sourceId: "s1",
        title: "Database Patterns",
        content: "SQLite optimization techniques for local storage",
      });
    });

    it("should find documents by content match", () => {
      const results = knowledgeStore.search("Express Node");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toBe("REST API Guide");
    });

    it("should find documents by title match", () => {
      const results = knowledgeStore.search("GraphQL");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toBe("GraphQL Tutorial");
    });

    it("should return scored results", () => {
      const results = knowledgeStore.search("SQLite");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]).toHaveProperty("score");
      expect(typeof results[0].score).toBe("number");
    });

    it("should return empty for no match", () => {
      const results = knowledgeStore.search("kubernetes");
      expect(results).toHaveLength(0);
    });

    it("should respect limit", () => {
      const results = knowledgeStore.search("API OR GraphQL OR SQLite", 1);
      expect(results).toHaveLength(1);
    });
  });

  // ── Delete ─────────────────────────────────────

  describe("delete", () => {
    it("should delete a document by ID", () => {
      const doc = knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "f1",
        title: "To Delete",
        content: "Will be deleted",
      });

      expect(knowledgeStore.delete(doc.id)).toBe(true);
      expect(knowledgeStore.getById(doc.id)).toBeNull();
    });

    it("should return false for non-existent delete", () => {
      expect(knowledgeStore.delete("kdoc_nonexistent")).toBe(false);
    });

    it("should delete all documents by source", () => {
      knowledgeStore.insert({ sourceType: "serena", sourceId: "mem-1", title: "Mem 1", content: "Memory A" });
      knowledgeStore.insert({ sourceType: "serena", sourceId: "mem-1", title: "Mem 1 Chunk 2", content: "Memory B", chunkIndex: 1 });
      knowledgeStore.insert({ sourceType: "upload", sourceId: "f1", title: "Upload", content: "Upload content" });

      const deleted = knowledgeStore.deleteBySource("serena", "mem-1");
      expect(deleted).toBe(2);
      expect(knowledgeStore.count()).toBe(1);
    });
  });

  // ── Count ──────────────────────────────────────

  describe("count", () => {
    it("should return 0 for empty store", () => {
      expect(knowledgeStore.count()).toBe(0);
    });

    it("should count all documents", () => {
      knowledgeStore.insert({ sourceType: "upload", sourceId: "f1", title: "A", content: "Content A" });
      knowledgeStore.insert({ sourceType: "docs", sourceId: "d1", title: "B", content: "Content B" });
      expect(knowledgeStore.count()).toBe(2);
    });

    it("should count by source type", () => {
      knowledgeStore.insert({ sourceType: "upload", sourceId: "f1", title: "A", content: "Content A" });
      knowledgeStore.insert({ sourceType: "upload", sourceId: "f2", title: "B", content: "Content B" });
      knowledgeStore.insert({ sourceType: "docs", sourceId: "d1", title: "C", content: "Content C" });

      expect(knowledgeStore.count("upload")).toBe(2);
      expect(knowledgeStore.count("docs")).toBe(1);
      expect(knowledgeStore.count("serena")).toBe(0);
    });
  });

  // ── Chunks ─────────────────────────────────────

  describe("chunks", () => {
    it("should insert multiple chunks and retrieve by source ID", () => {
      const chunks = knowledgeStore.insertChunks([
        { sourceType: "upload", sourceId: "big-file", title: "Big Doc - 0", content: "Chunk zero", chunkIndex: 0 },
        { sourceType: "upload", sourceId: "big-file", title: "Big Doc - 1", content: "Chunk one", chunkIndex: 1 },
        { sourceType: "upload", sourceId: "big-file", title: "Big Doc - 2", content: "Chunk two", chunkIndex: 2 },
      ]);

      expect(chunks).toHaveLength(3);

      const retrieved = knowledgeStore.getBySourceId("big-file");
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].chunkIndex).toBe(0);
      expect(retrieved[1].chunkIndex).toBe(1);
      expect(retrieved[2].chunkIndex).toBe(2);
    });
  });

  // ── Content Hash ───────────────────────────────

  describe("contentHash", () => {
    it("should produce consistent hashes", () => {
      const hash1 = contentHash("test content");
      const hash2 = contentHash("test content");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different content", () => {
      const hash1 = contentHash("content A");
      const hash2 = contentHash("content B");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce a hex string", () => {
      const hash = contentHash("test");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
