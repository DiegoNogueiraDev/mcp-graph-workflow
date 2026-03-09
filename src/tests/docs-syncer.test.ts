import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { DocsCacheStore } from "../core/docs/docs-cache-store.js";
import { DocsSyncer, type Context7Fetcher } from "../core/docs/docs-syncer.js";

function createMockFetcher(overrides: Partial<Context7Fetcher> = {}): Context7Fetcher {
  return {
    resolveLibraryId: overrides.resolveLibraryId ?? vi.fn(async (name: string) => `lib:${name}`),
    queryDocs: overrides.queryDocs ?? vi.fn(async (libId: string) => `Docs for ${libId}`),
  };
}

describe("DocsSyncer", () => {
  let sqliteStore: SqliteStore;
  let cacheStore: DocsCacheStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Test Project");
    cacheStore = new DocsCacheStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  it("should sync a lib by calling fetcher and persisting result", async () => {
    const fetcher = createMockFetcher();
    const syncer = new DocsSyncer(cacheStore, fetcher);

    const doc = await syncer.syncLib("express");

    expect(doc.libId).toBe("lib:express");
    expect(doc.libName).toBe("express");
    expect(doc.content).toBe("Docs for lib:express");
    expect(fetcher.resolveLibraryId).toHaveBeenCalledWith("express");
    expect(fetcher.queryDocs).toHaveBeenCalledWith("lib:express");
  });

  it("should upsert existing doc on re-sync", async () => {
    const fetcher = createMockFetcher({
      queryDocs: vi.fn()
        .mockResolvedValueOnce("Version 1")
        .mockResolvedValueOnce("Version 2"),
    });
    const syncer = new DocsSyncer(cacheStore, fetcher);

    await syncer.syncLib("react");
    const doc2 = await syncer.syncLib("react");

    expect(doc2.content).toBe("Version 2");
    expect(cacheStore.listCached()).toHaveLength(1);
  });

  it("should sync all stale libs", async () => {
    // Insert a stale doc
    const db = sqliteStore.getDb();
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT INTO docs_cache (lib_id, lib_name, content, fetched_at)
       VALUES (?, ?, ?, ?)`,
    ).run("lib:stale", "stale-lib", "Old content", oldDate);

    const fetcher = createMockFetcher({
      resolveLibraryId: vi.fn(async () => "lib:stale"),
      queryDocs: vi.fn(async () => "Updated content"),
    });
    const syncer = new DocsSyncer(cacheStore, fetcher);

    const results = await syncer.syncAll();

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("Updated content");
  });

  it("should handle fetcher errors gracefully during syncAll", async () => {
    const db = sqliteStore.getDb();
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT INTO docs_cache (lib_id, lib_name, content, fetched_at)
       VALUES (?, ?, ?, ?)`,
    ).run("lib:fail", "fail-lib", "Content", oldDate);

    const fetcher = createMockFetcher({
      resolveLibraryId: vi.fn(async () => {
        throw new Error("Network error");
      }),
    });
    const syncer = new DocsSyncer(cacheStore, fetcher);

    const results = await syncer.syncAll();

    expect(results).toHaveLength(0);
  });

  it("should not sync libs that are still fresh", async () => {
    // Insert a fresh doc
    cacheStore.upsertDoc({ libId: "lib:fresh", libName: "fresh", content: "Fresh" });

    const fetcher = createMockFetcher();
    const syncer = new DocsSyncer(cacheStore, fetcher);

    const results = await syncer.syncAll();

    expect(results).toHaveLength(0);
    expect(fetcher.resolveLibraryId).not.toHaveBeenCalled();
  });

  it("should propagate errors from syncLib", async () => {
    const fetcher = createMockFetcher({
      resolveLibraryId: vi.fn(async () => {
        throw new Error("API down");
      }),
    });
    const syncer = new DocsSyncer(cacheStore, fetcher);

    await expect(syncer.syncLib("broken")).rejects.toThrow("API down");
  });
});
