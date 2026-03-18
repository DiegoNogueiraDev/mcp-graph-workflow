import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { StoreManager } from "../core/store/store-manager.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { STORE_DIR } from "../core/utils/constants.js";

describe("StoreManager", () => {
  const tmpDirs: string[] = [];

  function createProjectDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), "mcp-sm-test-"));
    tmpDirs.push(dir);
    const storeDir = path.join(dir, STORE_DIR);
    mkdirSync(storeDir, { recursive: true });
    const store = SqliteStore.open(dir);
    store.initProject("Test");
    store.close();
    return dir;
  }

  afterEach(() => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it("should create a StoreManager with valid path", () => {
    const dir = createProjectDir();
    const manager = StoreManager.create(dir);
    expect(manager.store).toBeDefined();
    expect(manager.basePath).toBe(dir);
    expect(manager.storeRef.current).toBe(manager.store);
    manager.close();
  });

  it("should expose recentFolders as array", () => {
    const dir = createProjectDir();
    const manager = StoreManager.create(dir);
    expect(Array.isArray(manager.recentFolders)).toBe(true);
    manager.close();
  });

  it("should provide getBasePathFn that returns basePath", () => {
    const dir = createProjectDir();
    const manager = StoreManager.create(dir);
    const fn = manager.getBasePathFn;
    expect(fn()).toBe(dir);
    manager.close();
  });

  it("should swap to a new project directory", () => {
    const dir1 = createProjectDir();
    const dir2 = createProjectDir();
    const manager = StoreManager.create(dir1);
    const result = manager.swap(dir2);
    expect(result.ok).toBe(true);
    expect(manager.basePath).toBe(dir2);
    manager.close();
  });

  it("should return error when swapping to nonexistent directory", () => {
    const dir = createProjectDir();
    const manager = StoreManager.create(dir);
    const result = manager.swap("/nonexistent/path/xyz123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not exist");
    }
    manager.close();
  });

  it("should return error when swapping to directory without graph.db", () => {
    const dir = createProjectDir();
    const emptyDir = mkdtempSync(path.join(tmpdir(), "mcp-sm-empty-"));
    tmpDirs.push(emptyDir);
    const manager = StoreManager.create(dir);
    const result = manager.swap(emptyDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("No graph database found");
    }
    manager.close();
  });

  it("should close store properly", () => {
    const dir = createProjectDir();
    const manager = StoreManager.create(dir);
    expect(() => manager.close()).not.toThrow();
  });

  it("should expose recentFilePath", () => {
    const dir = createProjectDir();
    const manager = StoreManager.create(dir);
    expect(manager.recentFilePath).toContain("mcp-graph-recent-folders.json");
    manager.close();
  });
});
