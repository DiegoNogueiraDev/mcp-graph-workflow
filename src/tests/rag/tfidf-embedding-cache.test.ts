/**
 * TDD tests for TF-IDF embedding cache in rag-pipeline.
 * Task 4.1: Cache embedding vectors per query to avoid recalculation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TfIdfEmbeddingCache } from "../../core/rag/tfidf-embedding-cache.js";

describe("TfIdfEmbeddingCache", () => {
  let cache: TfIdfEmbeddingCache;

  beforeEach(() => {
    cache = new TfIdfEmbeddingCache({ maxSize: 200, ttlMs: 10 * 60 * 1000 });
  });

  it("should return undefined for cache miss", () => {
    expect(cache.get("unknown query")).toBeUndefined();
  });

  it("should cache and retrieve embedding vectors", () => {
    const vector = [0.1, 0.2, 0.3, 0.4];
    cache.set("test query", vector);

    const cached = cache.get("test query");
    expect(cached).toBeDefined();
    expect(cached).toEqual(vector);
  });

  it("should normalize query keys (case-insensitive, trimmed)", () => {
    const vector = [0.5, 0.6];
    cache.set("  Test Query  ", vector);

    expect(cache.get("test query")).toEqual(vector);
    expect(cache.get("TEST QUERY")).toEqual(vector);
  });

  it("should return same reference on cache hit (no recalculation)", () => {
    const vector = [0.1, 0.2, 0.3];
    cache.set("query", vector);

    const hit1 = cache.get("query");
    const hit2 = cache.get("query");
    expect(hit1).toBe(hit2); // same reference = no recomputation
  });

  it("should invalidate all entries", () => {
    cache.set("a", [0.1]);
    cache.set("b", [0.2]);

    cache.invalidateAll();

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });

  it("should evict entries when maxSize exceeded", () => {
    const small = new TfIdfEmbeddingCache({ maxSize: 2, ttlMs: 60000 });

    small.set("first", [0.1]);
    small.set("second", [0.2]);
    small.set("third", [0.3]); // should evict LRU

    // "first" was least recently used — should be evicted
    expect(small.get("second")).toBeDefined();
    expect(small.get("third")).toBeDefined();
    expect(small.getStats().size).toBeLessThanOrEqual(2);
  });

  it("should track hit and miss statistics", () => {
    cache.set("exists", [0.1, 0.2]);

    cache.get("exists");   // hit
    cache.get("missing");  // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });
});
