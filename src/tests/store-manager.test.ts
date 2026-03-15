import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { StoreManager } from "../core/store/store-manager.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { STORE_DIR, DB_FILE } from "../core/utils/constants.js";

function createTempProject(name: string): string {
  const dir = path.join(os.tmpdir(), `mcp-graph-test-${name}-${Date.now()}`);
  const storeDir = path.join(dir, STORE_DIR);
  mkdirSync(storeDir, { recursive: true });
  // Create a valid SQLite DB by opening and closing a store
  const store = SqliteStore.open(dir);
  store.initProject(name);
  store.close();
  return dir;
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("StoreManager", () => {
  let initialPath: string;
  let manager: StoreManager;
  const tempDirs: string[] = [];

  beforeEach(() => {
    initialPath = createTempProject("initial");
    tempDirs.push(initialPath);
    manager = StoreManager.create(initialPath);
  });

  afterEach(() => {
    manager.close();
    for (const dir of tempDirs) {
      cleanupDir(dir);
    }
    tempDirs.length = 0;
  });

  it("should create with valid basePath and expose store", () => {
    expect(manager.store).toBeInstanceOf(SqliteStore);
    expect(manager.basePath).toBe(initialPath);
  });

  it("should expose storeRef that wraps current store", () => {
    const ref = manager.storeRef;
    expect(ref.current).toBe(manager.store);
  });

  it("should swap to a valid path", () => {
    const newPath = createTempProject("swapped");
    tempDirs.push(newPath);

    const result = manager.swap(newPath);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.basePath).toBe(newPath);
    }
    expect(manager.basePath).toBe(newPath);
  });

  it("should update storeRef.current after swap", () => {
    const ref = manager.storeRef;
    const oldStore = ref.current;

    const newPath = createTempProject("ref-test");
    tempDirs.push(newPath);

    manager.swap(newPath);

    expect(ref.current).not.toBe(oldStore);
    expect(ref.current).toBe(manager.store);
  });

  it("should reject nonexistent directory", () => {
    const result = manager.swap("/nonexistent/path/that/does/not/exist");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not exist");
    }
  });

  it("should reject path without graph.db", () => {
    const emptyDir = path.join(os.tmpdir(), `mcp-graph-test-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });
    tempDirs.push(emptyDir);

    const result = manager.swap(emptyDir);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("No graph database found");
    }
  });

  it("should keep old store active on swap failure", () => {
    const oldStore = manager.store;
    const oldPath = manager.basePath;

    manager.swap("/nonexistent/path");

    expect(manager.store).toBe(oldStore);
    expect(manager.basePath).toBe(oldPath);
  });

  it("should copy eventBus to new store on swap", () => {
    const eventBus = new GraphEventBus();
    manager.store.eventBus = eventBus;

    const newPath = createTempProject("eventbus-test");
    tempDirs.push(newPath);

    manager.swap(newPath);

    expect(manager.store.eventBus).toBe(eventBus);
  });

  it("should track recent folders", () => {
    const path1 = createTempProject("recent1");
    const path2 = createTempProject("recent2");
    tempDirs.push(path1, path2);

    manager.swap(path1);
    manager.swap(path2);

    const recent = manager.recentFolders;
    expect(recent).toContain(path1);
    expect(recent).toContain(path2);
    expect(recent).toContain(initialPath);
  });

  it("should deduplicate recent folders", () => {
    const path1 = createTempProject("dedup");
    tempDirs.push(path1);

    manager.swap(path1);
    manager.swap(initialPath);
    manager.swap(path1);

    const count = manager.recentFolders.filter((f) => f === path1).length;
    expect(count).toBe(1);
  });

  it("should limit recent folders to 10", () => {
    for (let i = 0; i < 12; i++) {
      const p = createTempProject(`limit-${i}`);
      tempDirs.push(p);
      manager.swap(p);
    }

    expect(manager.recentFolders.length).toBeLessThanOrEqual(10);
  });

  it("should persist recent folders to disk", () => {
    const recentFile = manager.recentFilePath;
    const path1 = createTempProject("persist");
    tempDirs.push(path1);

    manager.swap(path1);

    expect(existsSync(recentFile)).toBe(true);
    const data = JSON.parse(readFileSync(recentFile, "utf-8"));
    expect(Array.isArray(data)).toBe(true);
    expect(data).toContain(path1);
  });

  it("should load recent folders from disk on create", () => {
    const path1 = createTempProject("load");
    tempDirs.push(path1);
    manager.swap(path1);
    const recentFile = manager.recentFilePath;
    manager.close();

    // Create new manager — should load from disk
    const manager2 = StoreManager.create(initialPath);
    expect(manager2.recentFolders).toContain(path1);
    manager2.close();
  });

  it("should provide getBasePath getter function", () => {
    const getter = manager.getBasePathFn;
    expect(getter()).toBe(initialPath);

    const newPath = createTempProject("getter");
    tempDirs.push(newPath);
    manager.swap(newPath);

    expect(getter()).toBe(newPath);
  });
});
