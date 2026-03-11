import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { STORE_DIR, LEGACY_STORE_DIR, DB_FILE } from "../core/utils/constants.js";

describe("Store directory migration (.mcp-graph → workflow-graph)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `store-migration-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create workflow-graph/ when no directory exists", () => {
    const store = SqliteStore.open(tmpDir);
    store.close();

    expect(existsSync(path.join(tmpDir, STORE_DIR))).toBe(true);
    expect(existsSync(path.join(tmpDir, STORE_DIR, DB_FILE))).toBe(true);
    expect(existsSync(path.join(tmpDir, LEGACY_STORE_DIR))).toBe(false);
  });

  it("should migrate .mcp-graph/ to workflow-graph/ when only legacy exists", () => {
    // Arrange: create legacy directory with a DB
    const legacyDir = path.join(tmpDir, LEGACY_STORE_DIR);
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(path.join(legacyDir, "marker.txt"), "legacy-data");

    // Act
    const store = SqliteStore.open(tmpDir);
    store.close();

    // Assert: legacy renamed to new
    expect(existsSync(path.join(tmpDir, STORE_DIR))).toBe(true);
    expect(existsSync(path.join(tmpDir, LEGACY_STORE_DIR))).toBe(false);
    expect(existsSync(path.join(tmpDir, STORE_DIR, "marker.txt"))).toBe(true);
    expect(existsSync(path.join(tmpDir, STORE_DIR, DB_FILE))).toBe(true);
  });

  it("should use workflow-graph/ when both directories exist", () => {
    // Arrange: create both directories
    mkdirSync(path.join(tmpDir, LEGACY_STORE_DIR), { recursive: true });
    mkdirSync(path.join(tmpDir, STORE_DIR), { recursive: true });

    // Act
    const store = SqliteStore.open(tmpDir);
    store.close();

    // Assert: uses new directory, legacy untouched
    expect(existsSync(path.join(tmpDir, STORE_DIR))).toBe(true);
    expect(existsSync(path.join(tmpDir, STORE_DIR, DB_FILE))).toBe(true);
    // Legacy still exists (not deleted, just ignored)
    expect(existsSync(path.join(tmpDir, LEGACY_STORE_DIR))).toBe(true);
  });

  it("should preserve existing workflow-graph/ data", () => {
    // Arrange: create workflow-graph with existing DB
    const newDir = path.join(tmpDir, STORE_DIR);
    mkdirSync(newDir, { recursive: true });

    // Create a store first to populate DB
    const store1 = SqliteStore.open(tmpDir);
    store1.initProject("test-project");
    store1.close();

    // Act: open again
    const store2 = SqliteStore.open(tmpDir);
    const project = store2.getProject();

    // Assert: data preserved
    expect(project).not.toBeNull();
    expect(project!.name).toBe("test-project");
    store2.close();
  });
});
