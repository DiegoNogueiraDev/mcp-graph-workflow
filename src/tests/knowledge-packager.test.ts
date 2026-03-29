import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore, contentHash } from "../core/store/knowledge-store.js";
import {
  exportKnowledge,
  importKnowledge,
  previewImport,
} from "../core/knowledge/knowledge-packager.js";
import { KnowledgePackageSchema, type KnowledgePackage } from "../schemas/knowledge-package.schema.js";
import { TranslationMemory } from "../core/translation/memory/translation-memory.js";

// Shared mutable state for mock memory reader
const memoryStore = new Map<string, string>();

vi.mock("../core/memory/memory-reader.js", () => ({
  readAllMemories: vi.fn(async () =>
    Array.from(memoryStore.entries()).map(([name, content]) => ({
      name,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
    })),
  ),
  listMemories: vi.fn(async () => Array.from(memoryStore.keys())),
  writeMemory: vi.fn(async (_basePath: string, name: string, content: string) => {
    memoryStore.set(name, content);
  }),
}));

describe("KnowledgePackager", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Test Project");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());

    // Ensure translation_memory table exists
    new TranslationMemory(sqliteStore.getDb());

    memoryStore.clear();
  });

  afterEach(() => {
    sqliteStore.close();
  });

  // ── Export tests ────────────────────────────────

  describe("exportKnowledge", () => {
    it("should return empty package when no knowledge docs exist", async () => {
      const result = await exportKnowledge(sqliteStore.getDb(), "/test");

      expect(result.package.version).toBe("1.0");
      expect(result.package.documents).toHaveLength(0);
      expect(result.stats.documents).toBe(0);
      expect(result.stats.memories).toBe(0);
      expect(result.stats.relations).toBe(0);
      expect(result.stats.translationEntries).toBe(0);
    });

    it("should export documents with correct count", async () => {
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "express/express",
        title: "Express Docs",
        content: "Express is a web framework",
      });
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "mem-001",
        title: "Architecture Decision",
        content: "We chose SQLite for persistence",
      });

      const result = await exportKnowledge(sqliteStore.getDb(), "/test");

      expect(result.package.documents).toHaveLength(2);
      expect(result.stats.documents).toBe(2);
      expect(result.package.manifest.documentCount).toBe(2);
      expect(result.package.manifest.projectName).toBe("Test Project");
    });

    it("should filter by source_type", async () => {
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "express/express",
        title: "Express Docs",
        content: "Express is a web framework",
      });
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "mem-001",
        title: "Architecture Decision",
        content: "We chose SQLite for persistence",
      });

      const result = await exportKnowledge(sqliteStore.getDb(), "/test", {
        sources: ["docs"],
      });

      expect(result.package.documents).toHaveLength(1);
      expect(result.package.documents[0].sourceType).toBe("docs");
      expect(result.package.manifest.sourceTypes).toEqual(["docs"]);
    });

    it("should filter by minQuality", async () => {
      const doc1 = knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "high-quality",
        title: "High Quality Doc",
        content: "This is a high quality document",
      });
      knowledgeStore.updateQualityScore(doc1.id, 0.9);

      const doc2 = knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "low-quality",
        title: "Low Quality Doc",
        content: "This is a low quality document",
      });
      knowledgeStore.updateQualityScore(doc2.id, 0.2);

      const result = await exportKnowledge(sqliteStore.getDb(), "/test", {
        minQuality: 0.5,
      });

      expect(result.package.documents).toHaveLength(1);
      expect(result.package.documents[0].title).toBe("High Quality Doc");
    });

    it("should include memories when enabled", async () => {
      memoryStore.set("architecture", "# Architecture\nSQLite-based storage");
      memoryStore.set("decisions", "# Decisions\nUsing Vitest");

      const result = await exportKnowledge(sqliteStore.getDb(), "/test", {
        includeMemories: true,
      });

      expect(result.package.memories).toHaveLength(2);
      expect(result.stats.memories).toBe(2);
    });

    it("should exclude memories when disabled", async () => {
      memoryStore.set("architecture", "# Architecture\nSQLite-based storage");

      const result = await exportKnowledge(sqliteStore.getDb(), "/test", {
        includeMemories: false,
      });

      expect(result.package.memories).toBeUndefined();
      expect(result.stats.memories).toBe(0);
    });

    it("should produce a valid package per schema", async () => {
      knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "file-001",
        title: "Test Doc",
        content: "Test content",
      });

      const result = await exportKnowledge(sqliteStore.getDb(), "/test");
      const parsed = KnowledgePackageSchema.safeParse(result.package);

      expect(parsed.success).toBe(true);
    });
  });

  // ── Import tests ────────────────────────────────

  describe("importKnowledge", () => {
    it("should import documents into empty store", async () => {
      const pkg = buildMinimalPackage([
        {
          sourceType: "docs",
          sourceId: "react/react",
          title: "React Docs",
          content: "React is a UI library",
          contentHash: contentHash("React is a UI library"),
          createdAt: new Date().toISOString(),
        },
      ]);

      const result = await importKnowledge(sqliteStore.getDb(), "/test", pkg);

      expect(result.documentsImported).toBe(1);
      expect(result.documentsSkipped).toBe(0);
      expect(knowledgeStore.count()).toBe(1);
    });

    it("should deduplicate by content_hash", async () => {
      const content = "Express is a web framework";
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "express/express",
        title: "Express Docs",
        content,
      });

      const pkg = buildMinimalPackage([
        {
          sourceType: "docs",
          sourceId: "express/express",
          title: "Express Docs",
          content,
          contentHash: contentHash(content),
          createdAt: new Date().toISOString(),
        },
      ]);

      const result = await importKnowledge(sqliteStore.getDb(), "/test", pkg);

      expect(result.documentsImported).toBe(0);
      expect(result.documentsSkipped).toBe(1);
      expect(knowledgeStore.count()).toBe(1);
    });

    it("should skip existing memories", async () => {
      memoryStore.set("architecture", "# Existing Architecture");

      const pkg = buildMinimalPackage([], {
        memories: [
          { name: "architecture", content: "# New Architecture" },
          { name: "new-memory", content: "# Brand New" },
        ],
      });

      const result = await importKnowledge(sqliteStore.getDb(), "/test", pkg);

      expect(result.memoriesImported).toBe(1);
      expect(result.memoriesSkipped).toBe(1);
      // Existing memory should not be overwritten
      expect(memoryStore.get("architecture")).toBe("# Existing Architecture");
      expect(memoryStore.get("new-memory")).toBe("# Brand New");
    });

    it("should reject invalid package with clear error", async () => {
      const invalidPkg = { version: "2.0", documents: [] } as unknown as KnowledgePackage;

      await expect(
        importKnowledge(sqliteStore.getDb(), "/test", invalidPkg),
      ).rejects.toThrow("Invalid knowledge package");
    });

    it("should import translation memory entries", async () => {
      const pkg = buildMinimalPackage([], {
        translationMemory: [
          {
            constructId: "class_declaration",
            sourceLanguage: "python",
            targetLanguage: "typescript",
            confidenceBoost: 0.15,
            acceptanceCount: 3,
            correctionCount: 0,
          },
        ],
      });

      const result = await importKnowledge(sqliteStore.getDb(), "/test", pkg);

      expect(result.translationEntriesImported).toBe(1);

      // Verify in DB
      const row = sqliteStore.getDb()
        .prepare("SELECT * FROM translation_memory WHERE construct_id = ?")
        .get("class_declaration") as { acceptance_count: number; confidence_boost: number } | undefined;

      expect(row).toBeDefined();
      expect(row!.acceptance_count).toBe(3);
      expect(row!.confidence_boost).toBeCloseTo(0.15);
    });
  });

  // ── Preview tests ───────────────────────────────

  describe("previewImport", () => {
    it("should show correct counts for new and existing docs", async () => {
      const existingContent = "Already in the store";
      knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "existing-001",
        title: "Existing Doc",
        content: existingContent,
      });

      const pkg = buildMinimalPackage([
        {
          sourceType: "upload",
          sourceId: "existing-001",
          title: "Existing Doc",
          content: existingContent,
          contentHash: contentHash(existingContent),
          createdAt: new Date().toISOString(),
        },
        {
          sourceType: "docs",
          sourceId: "new-001",
          title: "New Doc",
          content: "Brand new content",
          contentHash: contentHash("Brand new content"),
          createdAt: new Date().toISOString(),
        },
      ]);

      const preview = await previewImport(sqliteStore.getDb(), "/test", pkg);

      expect(preview.newDocuments).toBe(1);
      expect(preview.existingDocuments).toBe(1);
      expect(preview.sourceTypes).toContain("upload");
      expect(preview.sourceTypes).toContain("docs");
    });

    it("should show correct counts for new and existing memories", async () => {
      memoryStore.set("existing-mem", "# Existing");

      const pkg = buildMinimalPackage([], {
        memories: [
          { name: "existing-mem", content: "# Existing" },
          { name: "new-mem", content: "# New" },
        ],
      });

      const preview = await previewImport(sqliteStore.getDb(), "/test", pkg);

      expect(preview.newMemories).toBe(1);
      expect(preview.existingMemories).toBe(1);
    });

    it("should reject invalid package", async () => {
      const invalidPkg = { version: "bad" } as unknown as KnowledgePackage;

      await expect(
        previewImport(sqliteStore.getDb(), "/test", invalidPkg),
      ).rejects.toThrow("Invalid knowledge package");
    });
  });

  // ── Round-trip test ─────────────────────────────

  describe("round-trip", () => {
    it("should preserve all data through export then import into fresh DB", async () => {
      // Populate source store
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "react/react",
        title: "React Docs",
        content: "React is a UI library for building interfaces",
      });
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "decision-001",
        title: "Tech Decision",
        content: "Using Vitest for testing",
      });

      memoryStore.set("architecture", "# Architecture\nSQLite-based storage");

      // Export
      const exportResult = await exportKnowledge(sqliteStore.getDb(), "/test");
      expect(exportResult.stats.documents).toBe(2);
      expect(exportResult.stats.memories).toBe(1);

      // Import into fresh store
      const freshStore = SqliteStore.open(":memory:");
      freshStore.initProject("Fresh Project");
      new TranslationMemory(freshStore.getDb());

      // Clear memories to simulate fresh environment
      memoryStore.clear();

      const importResult = await importKnowledge(freshStore.getDb(), "/test", exportResult.package);

      expect(importResult.documentsImported).toBe(2);
      expect(importResult.documentsSkipped).toBe(0);
      expect(importResult.memoriesImported).toBe(1);

      // Verify documents exist in fresh store
      const freshKnowledge = new KnowledgeStore(freshStore.getDb());
      expect(freshKnowledge.count()).toBe(2);

      // Verify memory was written
      expect(memoryStore.has("architecture")).toBe(true);

      freshStore.close();
    });
  });
});

// ── Helpers ───────────────────────────────────────

function buildMinimalPackage(
  documents: KnowledgePackage["documents"],
  overrides?: {
    memories?: KnowledgePackage["memories"];
    translationMemory?: KnowledgePackage["translationMemory"];
    relations?: KnowledgePackage["relations"];
  },
): KnowledgePackage {
  return {
    version: "1.0",
    manifest: {
      projectName: "Source Project",
      exportedAt: new Date().toISOString(),
      documentCount: documents.length,
      memoryCount: overrides?.memories?.length ?? 0,
      sourceTypes: [...new Set(documents.map((d) => d.sourceType))],
      qualityThreshold: 0,
    },
    documents,
    relations: overrides?.relations,
    memories: overrides?.memories,
    translationMemory: overrides?.translationMemory,
  };
}
