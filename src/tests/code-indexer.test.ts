import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import { CodeStore } from "../core/code/code-store.js";
import { CodeIndexer } from "../core/code/code-indexer.js";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("CodeIndexer", () => {
  let db: Database.Database;
  let store: CodeStore;
  let indexer: CodeIndexer;
  const projectId = "proj_indexer";

  // Use the project's own src/core/utils/ as a real fixture
  const FIXTURE_DIR = path.resolve(import.meta.dirname, "..", "core", "utils");

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new CodeStore(db);
    indexer = new CodeIndexer(store, projectId);
  });

  afterEach(() => {
    db.close();
  });

  describe("indexDirectory", () => {
    it("should index TypeScript files from a directory", async () => {
      const result = await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      expect(result.fileCount).toBeGreaterThan(0);
      expect(result.symbolCount).toBeGreaterThan(0);
      expect(store.getSymbolCount(projectId)).toBe(result.symbolCount);
    });

    it("should extract known symbols from utils directory", async () => {
      await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      const generateIdSymbols = store.findSymbolsByName("generateId", projectId);
      expect(generateIdSymbols.length).toBeGreaterThanOrEqual(1);
      expect(generateIdSymbols[0].kind).toBe("function");
      expect(generateIdSymbols[0].exported).toBe(true);

      const nowSymbols = store.findSymbolsByName("now", projectId);
      expect(nowSymbols.length).toBeGreaterThanOrEqual(1);
    });

    it("should update index metadata", async () => {
      await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      const meta = store.getIndexMeta(projectId);
      expect(meta).not.toBeNull();
      expect(meta!.fileCount).toBeGreaterThan(0);
      expect(meta!.symbolCount).toBeGreaterThan(0);
    });

    it("should store git hash in index metadata", async () => {
      await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      const meta = store.getIndexMeta(projectId);
      expect(meta).not.toBeNull();
      // FIXTURE_DIR is inside a git repo, so gitHash should be captured
      expect(meta!.gitHash).toBeTruthy();
      expect(meta!.gitHash!.length).toBe(40); // SHA-1 hex
    });
  });

  describe("indexFiles", () => {
    it("should index specific files", async () => {
      const files = [
        path.join(FIXTURE_DIR, "id.ts"),
        path.join(FIXTURE_DIR, "time.ts"),
      ];

      const result = await indexer.indexFiles(files, FIXTURE_DIR);

      expect(result.fileCount).toBe(2);
      expect(result.symbolCount).toBeGreaterThanOrEqual(2); // generateId + now
    });
  });

  describe("typescriptAvailable field", () => {
    it("should include typescriptAvailable: true in IndexResult when typescript is installed", async () => {
      const result = await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      expect(result).toHaveProperty("typescriptAvailable");
      expect(result.typescriptAvailable).toBe(true);
    });
  });

  describe("filesWithSymbols metric", () => {
    it("should track filesWithSymbols separately from fileCount", async () => {
      const result = await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      // fileCount = total files scanned (including those with 0 symbols)
      expect(result.fileCount).toBeGreaterThan(0);
      // filesWithSymbols = files that produced at least 1 symbol
      expect(result.filesWithSymbols).toBeGreaterThan(0);
      expect(result.filesWithSymbols).toBeLessThanOrEqual(result.fileCount);
    });
  });

  describe("TEST_OR_DECL_PATTERN filter", () => {
    // Import the pattern directly for unit testing
    it("should exclude .test.tsx and .spec.tsx files", async () => {
      const { TEST_OR_DECL_PATTERN } = await import("../core/code/code-indexer.js");
      expect(TEST_OR_DECL_PATTERN.test("component.test.tsx")).toBe(true);
      expect(TEST_OR_DECL_PATTERN.test("component.spec.tsx")).toBe(true);
      expect(TEST_OR_DECL_PATTERN.test("component.test.ts")).toBe(true);
      expect(TEST_OR_DECL_PATTERN.test("component.spec.ts")).toBe(true);
      expect(TEST_OR_DECL_PATTERN.test("component.test.js")).toBe(true);
      expect(TEST_OR_DECL_PATTERN.test("component.test.jsx")).toBe(true);
      expect(TEST_OR_DECL_PATTERN.test("types.d.ts")).toBe(true);
      expect(TEST_OR_DECL_PATTERN.test("types.d.mts")).toBe(true);
    });

    it("should NOT exclude regular source files", async () => {
      const { TEST_OR_DECL_PATTERN } = await import("../core/code/code-indexer.js");
      expect(TEST_OR_DECL_PATTERN.test("component.tsx")).toBe(false);
      expect(TEST_OR_DECL_PATTERN.test("utils.ts")).toBe(false);
      expect(TEST_OR_DECL_PATTERN.test("app.jsx")).toBe(false);
      expect(TEST_OR_DECL_PATTERN.test("index.js")).toBe(false);
    });
  });

  describe("reindex (incremental)", () => {
    it("should clear old data before reindexing", async () => {
      await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);
      const firstCount = store.getSymbolCount(projectId);

      // Reindex same directory
      await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);
      const secondCount = store.getSymbolCount(projectId);

      // Should not duplicate symbols
      expect(secondCount).toBe(firstCount);
    });
  });
});
