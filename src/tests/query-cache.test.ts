import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryCache } from "../core/rag/query-cache.js";
import type { RankedResult } from "../core/rag/multi-strategy-retrieval.js";

function makeResult(id: string): RankedResult {
  return {
    id,
    sourceType: "docs",
    sourceId: "src-1",
    title: "Test",
    content: "Content",
    score: 0.8,
    qualityScore: 0.7,
    strategies: ["fts"],
  };
}

describe("query-cache", () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = new QueryCache({ ttlMs: 5000, maxSize: 100 });
  });

  it("should return undefined for cache miss", () => {
    expect(cache.get("unknown query")).toBeUndefined();
  });

  it("should cache and retrieve results", () => {
    const results = [makeResult("a"), makeResult("b")];
    cache.set("test query", results);

    const cached = cache.get("test query");
    expect(cached).toBeDefined();
    expect(cached!).toHaveLength(2);
    expect(cached![0].id).toBe("a");
  });

  it("should normalize queries (case-insensitive, trimmed)", () => {
    cache.set("  Test Query  ", [makeResult("a")]);

    expect(cache.get("test query")).toBeDefined();
    expect(cache.get("TEST QUERY")).toBeDefined();
  });

  it("should return undefined for expired entries", () => {
    vi.useFakeTimers();
    try {
      cache = new QueryCache({ ttlMs: 100, maxSize: 100 });
      cache.set("query", [makeResult("a")]);

      expect(cache.get("query")).toBeDefined();

      vi.advanceTimersByTime(200);

      expect(cache.get("query")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("should track hit and miss counts", () => {
    cache.set("exists", [makeResult("a")]);

    cache.get("exists"); // hit
    cache.get("missing"); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it("should evict oldest entry when maxSize exceeded", () => {
    cache = new QueryCache({ ttlMs: 60000, maxSize: 2 });

    cache.set("first", [makeResult("a")]);
    cache.set("second", [makeResult("b")]);
    cache.set("third", [makeResult("c")]); // should evict "first"

    expect(cache.get("first")).toBeUndefined();
    expect(cache.get("second")).toBeDefined();
    expect(cache.get("third")).toBeDefined();
  });

  it("should invalidate all entries", () => {
    cache.set("a", [makeResult("1")]);
    cache.set("b", [makeResult("2")]);

    cache.invalidateAll();

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.getStats().size).toBe(0);
  });
});
