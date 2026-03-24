/**
 * Isolated tests for CodeIndexer when typescript package is unavailable.
 * Uses vi.mock to simulate missing typescript — must be in separate file
 * from tests that need real typescript.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import { CodeStore } from "../core/code/code-store.js";
import { CodeIndexer } from "../core/code/code-indexer.js";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { resetTypeScriptLoader } from "../core/code/ts-analyzer.js";

// Mock typescript as unavailable
vi.mock("typescript", () => {
  throw new Error("Cannot find module 'typescript'");
});

describe("CodeIndexer (typescript unavailable)", () => {
  let db: Database.Database;
  let store: CodeStore;
  let indexer: CodeIndexer;
  const projectId = "proj_no_ts";

  const FIXTURE_DIR = path.resolve(import.meta.dirname, "..", "core", "utils");

  beforeEach(() => {
    resetTypeScriptLoader();
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new CodeStore(db);
    indexer = new CodeIndexer(store, projectId);
  });

  afterEach(() => {
    db.close();
  });

  it("should return typescriptAvailable: false when typescript is unavailable", async () => {
    const result = await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

    expect(result.typescriptAvailable).toBe(false);
  });

  it("should return fileCount: 0 when typescript is unavailable", async () => {
    const result = await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

    expect(result.fileCount).toBe(0);
    expect(result.symbolCount).toBe(0);
    expect(result.relationCount).toBe(0);
  });

  it("should log warning when typescript is unavailable during indexing", async () => {
    const { logger } = await import("../core/utils/logger.js");
    const warnSpy = vi.spyOn(logger, "warn");

    await indexer.indexDirectory(FIXTURE_DIR, FIXTURE_DIR);

    expect(warnSpy).toHaveBeenCalledWith(
      "code-indexer:typescript-unavailable",
      expect.objectContaining({
        message: expect.stringContaining("typescript"),
      }),
    );

    warnSpy.mockRestore();
  });
});
