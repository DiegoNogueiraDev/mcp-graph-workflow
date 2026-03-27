import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { LspCache } from "../../core/lsp/lsp-cache.js";

describe("LspCache", () => {
  let db: Database.Database;
  let cache: LspCache;
  const PROJECT = "proj-1";

  beforeEach(() => {
    db = new Database(":memory:");
    cache = new LspCache(db);
  });

  // ---- 1. get returns null for missing key ----
  it("should return null for a missing cache key", () => {
    const result = cache.get(PROJECT, "nonexistent", "1000");
    expect(result).toBeNull();
  });

  // ---- 2. set and get ----
  it("should store a result and retrieve it with matching mtime", () => {
    const payload = { symbols: ["foo", "bar"] };
    cache.set(PROJECT, "key-1", "hover", "typescript", "src/a.ts", payload, "1000");

    const result = cache.get(PROJECT, "key-1", "1000");
    expect(result).toEqual(payload);
  });

  // ---- 3. get returns null when mtime changed ----
  it("should return null when mtime changed", () => {
    cache.set(PROJECT, "key-1", "hover", "typescript", "src/a.ts", { ok: true }, "1000");

    const result = cache.get(PROJECT, "key-1", "2000");
    expect(result).toBeNull();
  });

  // ---- 4. set overwrites existing entry ----
  it("should overwrite existing entry with same key", () => {
    cache.set(PROJECT, "key-1", "hover", "typescript", "src/a.ts", { v: 1 }, "1000");
    cache.set(PROJECT, "key-1", "hover", "typescript", "src/a.ts", { v: 2 }, "2000");

    const result = cache.get(PROJECT, "key-1", "2000");
    expect(result).toEqual({ v: 2 });

    // old mtime no longer matches
    expect(cache.get(PROJECT, "key-1", "1000")).toBeNull();
  });

  // ---- 5. invalidateFile removes entries for that file ----
  it("should invalidate all entries for a given file", () => {
    cache.set(PROJECT, "k1", "hover", "typescript", "src/a.ts", { a: 1 }, "100");
    cache.set(PROJECT, "k2", "complete", "typescript", "src/a.ts", { a: 2 }, "100");
    cache.set(PROJECT, "k3", "hover", "typescript", "src/b.ts", { b: 1 }, "100");

    const deleted = cache.invalidateFile(PROJECT, "src/a.ts");
    expect(deleted).toBeGreaterThanOrEqual(2);

    expect(cache.get(PROJECT, "k1", "100")).toBeNull();
    expect(cache.get(PROJECT, "k2", "100")).toBeNull();
    expect(cache.get(PROJECT, "k3", "100")).toEqual({ b: 1 });
  });

  // ---- 6. invalidateFile removes entries referencing the file in result_json ----
  it("should invalidate entries that reference a file in result_json", () => {
    cache.set(PROJECT, "k1", "references", "typescript", "src/index.ts", { refs: ["src/fileA.ts:10"] }, "100");
    cache.set(PROJECT, "k2", "hover", "typescript", "src/other.ts", { data: "no ref" }, "100");

    const deleted = cache.invalidateFile(PROJECT, "fileA.ts");
    expect(deleted).toBeGreaterThanOrEqual(1);

    expect(cache.get(PROJECT, "k1", "100")).toBeNull();
    expect(cache.get(PROJECT, "k2", "100")).toEqual({ data: "no ref" });
  });

  // ---- 7. invalidateLanguage removes entries for that language ----
  it("should invalidate all entries for a given language", () => {
    cache.set(PROJECT, "k1", "hover", "typescript", "src/a.ts", {}, "100");
    cache.set(PROJECT, "k2", "hover", "typescript", "src/b.ts", {}, "100");
    cache.set(PROJECT, "k3", "hover", "python", "src/c.py", {}, "100");

    const deleted = cache.invalidateLanguage(PROJECT, "typescript");
    expect(deleted).toBe(2);

    expect(cache.get(PROJECT, "k1", "100")).toBeNull();
    expect(cache.get(PROJECT, "k2", "100")).toBeNull();
    expect(cache.get(PROJECT, "k3", "100")).toEqual({});
  });

  // ---- 8. invalidateAll removes all entries for project ----
  it("should invalidate all entries for a project", () => {
    cache.set(PROJECT, "k1", "hover", "typescript", "a.ts", {}, "100");
    cache.set(PROJECT, "k2", "complete", "python", "b.py", {}, "100");
    cache.set(PROJECT, "k3", "definition", "go", "c.go", {}, "100");

    const deleted = cache.invalidateAll(PROJECT);
    expect(deleted).toBe(3);

    const stats = cache.getStats(PROJECT);
    expect(stats.total).toBe(0);
  });

  // ---- 9. prune removes old entries ----
  it("should prune entries older than maxAgeDays", () => {
    // Insert an entry with a manually set old created_at
    cache.set(PROJECT, "k-old", "hover", "typescript", "old.ts", { old: true }, "100");

    // Manually backdate the created_at
    db.prepare(
      `UPDATE lsp_cache SET created_at = datetime('now', '-30 days') WHERE cache_key = ?`,
    ).run("k-old");

    cache.set(PROJECT, "k-new", "hover", "typescript", "new.ts", { new: true }, "200");

    const pruned = cache.prune(7);
    expect(pruned).toBe(1);

    expect(cache.get(PROJECT, "k-old", "100")).toBeNull();
    expect(cache.get(PROJECT, "k-new", "200")).toEqual({ new: true });
  });

  // ---- 10. getStats returns correct counts ----
  it("should return correct stats by language and operation", () => {
    cache.set(PROJECT, "k1", "hover", "typescript", "a.ts", {}, "100");
    cache.set(PROJECT, "k2", "complete", "typescript", "b.ts", {}, "100");
    cache.set(PROJECT, "k3", "hover", "python", "c.py", {}, "100");
    cache.set(PROJECT, "k4", "definition", "python", "d.py", {}, "100");
    cache.set(PROJECT, "k5", "definition", "go", "e.go", {}, "100");

    const stats = cache.getStats(PROJECT);

    expect(stats.total).toBe(5);

    expect(stats.byLanguage).toEqual({
      typescript: 2,
      python: 2,
      go: 1,
    });

    expect(stats.byOperation).toEqual({
      hover: 2,
      complete: 1,
      definition: 2,
    });
  });
});
