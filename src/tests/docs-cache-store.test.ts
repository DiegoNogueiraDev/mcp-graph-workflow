import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { DocsCacheStore, type CachedDoc } from "../core/docs/docs-cache-store.js";

describe("DocsCacheStore", () => {
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

  // ── CRUD ──────────────────────────────────────────

  it("should upsert and retrieve a doc", () => {
    const doc = cacheStore.upsertDoc({
      libId: "express/express",
      libName: "express",
      content: "Express is a web framework for Node.js",
    });

    expect(doc.libId).toBe("express/express");
    expect(doc.libName).toBe("express");
    expect(doc.content).toContain("Express");
    expect(doc.fetchedAt).toBeTruthy();
  });

  it("should retrieve a doc by libId", () => {
    cacheStore.upsertDoc({
      libId: "react/react",
      libName: "react",
      content: "React documentation",
    });

    const doc = cacheStore.getDoc("react/react");

    expect(doc).not.toBeNull();
    expect(doc!.libName).toBe("react");
  });

  it("should return null for non-existent doc", () => {
    const doc = cacheStore.getDoc("nonexistent");
    expect(doc).toBeNull();
  });

  it("should upsert (replace) existing doc for same lib_id", () => {
    cacheStore.upsertDoc({
      libId: "vue/vue",
      libName: "vue",
      content: "Vue v2 docs",
    });

    cacheStore.upsertDoc({
      libId: "vue/vue",
      libName: "vue",
      version: "3.0",
      content: "Vue v3 docs",
    });

    const doc = cacheStore.getDoc("vue/vue");
    expect(doc!.content).toBe("Vue v3 docs");
    expect(doc!.version).toBe("3.0");

    // Should still be only one record
    const all = cacheStore.listCached();
    expect(all).toHaveLength(1);
  });

  // ── List ──────────────────────────────────────────

  it("should list all cached docs ordered by fetched_at DESC", () => {
    cacheStore.upsertDoc({ libId: "a", libName: "alpha", content: "A" });
    cacheStore.upsertDoc({ libId: "b", libName: "beta", content: "B" });
    cacheStore.upsertDoc({ libId: "c", libName: "gamma", content: "C" });

    const all = cacheStore.listCached();
    expect(all).toHaveLength(3);
  });

  // ── FTS Search ────────────────────────────────────

  it("should find docs via FTS search on content", () => {
    cacheStore.upsertDoc({
      libId: "express/express",
      libName: "express",
      content: "Express is a minimal web framework",
    });
    cacheStore.upsertDoc({
      libId: "fastify/fastify",
      libName: "fastify",
      content: "Fastify is a fast HTTP framework",
    });

    const results = cacheStore.searchDocs("minimal web");
    expect(results).toHaveLength(1);
    expect(results[0].libName).toBe("express");
  });

  it("should find docs via FTS search on lib_name", () => {
    cacheStore.upsertDoc({
      libId: "react/react",
      libName: "react",
      content: "Component-based UI library",
    });

    const results = cacheStore.searchDocs("react");
    expect(results).toHaveLength(1);
    expect(results[0].libId).toBe("react/react");
  });

  // ── Stale libs ────────────────────────────────────

  it("should return empty for getStaleLibs when all docs are fresh", () => {
    cacheStore.upsertDoc({ libId: "fresh", libName: "fresh", content: "Fresh" });

    const stale = cacheStore.getStaleLibs(24 * 60 * 60 * 1000); // 24h
    expect(stale).toHaveLength(0);
  });

  it("should return stale libs when fetched_at is old", () => {
    // Insert a doc with an old fetched_at by directly manipulating the DB
    const db = sqliteStore.getDb();
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
    db.prepare(
      `INSERT INTO docs_cache (lib_id, lib_name, content, fetched_at)
       VALUES (?, ?, ?, ?)`,
    ).run("old-lib", "old-lib", "Old content", oldDate);

    cacheStore.upsertDoc({ libId: "new-lib", libName: "new-lib", content: "New" });

    const stale = cacheStore.getStaleLibs(24 * 60 * 60 * 1000);
    expect(stale).toHaveLength(1);
    expect(stale[0].libId).toBe("old-lib");
  });
});
