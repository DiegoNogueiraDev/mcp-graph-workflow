import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResponseCache } from "../core/rag/response-cache.js";

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ ttlMs: 5000, maxSize: 50 });
  });

  it("should cache and retrieve any value type", () => {
    const ctx = { query: "test", nodes: [{ id: "n1" }], tokens: 100 };
    cache.set("detail:test:4000", ctx);

    const cached = cache.get("detail:test:4000");
    expect(cached).toEqual(ctx);
  });

  it("should return undefined for cache miss", () => {
    expect(cache.get("missing")).toBeUndefined();
  });

  it("should normalize keys (case-insensitive, trimmed)", () => {
    cache.set("  Detail:Test  ", { data: 1 });
    expect(cache.get("detail:test")).toBeDefined();
  });

  it("should evict least-recently-accessed entry (true LRU)", () => {
    vi.useFakeTimers();
    try {
      cache = new ResponseCache({ ttlMs: 60000, maxSize: 2 });

      cache.set("first", { a: 1 });
      vi.advanceTimersByTime(10);
      cache.set("second", { b: 2 });

      // Access "first" to make it more recently used
      vi.advanceTimersByTime(10);
      cache.get("first");

      // Insert "third" — should evict "second" (least recently accessed)
      vi.advanceTimersByTime(10);
      cache.set("third", { c: 3 });

      expect(cache.get("first")).toBeDefined();
      expect(cache.get("second")).toBeUndefined();
      expect(cache.get("third")).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("should invalidate all entries", () => {
    cache.set("a", { x: 1 });
    cache.set("b", { y: 2 });

    cache.invalidateAll();

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.getStats().size).toBe(0);
  });

  it("should track hit and miss statistics", () => {
    cache.set("key", { data: true });
    cache.get("key");     // hit
    cache.get("missing"); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });
});
