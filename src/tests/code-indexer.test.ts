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
    it("should index TypeScript files from a directory", () => {
      const result = indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      expect(result.fileCount).toBeGreaterThan(0);
      expect(result.symbolCount).toBeGreaterThan(0);
      expect(store.getSymbolCount(projectId)).toBe(result.symbolCount);
    });

    it("should extract known symbols from utils directory", () => {
      indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      const generateIdSymbols = store.findSymbolsByName("generateId", projectId);
      expect(generateIdSymbols.length).toBeGreaterThanOrEqual(1);
      expect(generateIdSymbols[0].kind).toBe("function");
      expect(generateIdSymbols[0].exported).toBe(true);

      const nowSymbols = store.findSymbolsByName("now", projectId);
      expect(nowSymbols.length).toBeGreaterThanOrEqual(1);
    });

    it("should update index metadata", () => {
      indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

      const meta = store.getIndexMeta(projectId);
      expect(meta).not.toBeNull();
      expect(meta!.fileCount).toBeGreaterThan(0);
      expect(meta!.symbolCount).toBeGreaterThan(0);
    });
  });

  describe("indexFiles", () => {
    it("should index specific files", () => {
      const files = [
        path.join(FIXTURE_DIR, "id.ts"),
        path.join(FIXTURE_DIR, "time.ts"),
      ];

      const result = indexer.indexFiles(files, FIXTURE_DIR);

      expect(result.fileCount).toBe(2);
      expect(result.symbolCount).toBeGreaterThanOrEqual(2); // generateId + now
    });
  });

  describe("reindex (incremental)", () => {
    it("should clear old data before reindexing", () => {
      indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);
      const firstCount = store.getSymbolCount(projectId);

      // Reindex same directory
      indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);
      const secondCount = store.getSymbolCount(projectId);

      // Should not duplicate symbols
      expect(secondCount).toBe(firstCount);
    });
  });
});
