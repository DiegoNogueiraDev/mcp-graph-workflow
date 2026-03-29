/**
 * TDD tests for phase-boosted search cache.
 * Task 4.3: Cache searchWithPhaseBoost results by (query, phase).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PhaseBoostCache } from "../../core/rag/phase-boost-cache.js";

describe("PhaseBoostCache", () => {
  let cache: PhaseBoostCache;

  beforeEach(() => {
    cache = new PhaseBoostCache({ maxSize: 100, ttlMs: 2 * 60 * 1000 });
  });

  it("should return undefined for cache miss", () => {
    expect(cache.get("unknown", "IMPLEMENT")).toBeUndefined();
  });

  it("should cache and retrieve results by (query, phase)", () => {
    const results = [{ id: "1", title: "Test", score: 0.9 }];
    cache.set("test query", "IMPLEMENT", results);

    const cached = cache.get("test query", "IMPLEMENT");
    expect(cached).toBeDefined();
    expect(cached).toEqual(results);
  });

  it("should return different results for same query but different phase", () => {
    const implResults = [{ id: "1", score: 0.9 }];
    const planResults = [{ id: "2", score: 0.8 }];

    cache.set("query", "IMPLEMENT", implResults);
    cache.set("query", "PLAN", planResults);

    expect(cache.get("query", "IMPLEMENT")).toEqual(implResults);
    expect(cache.get("query", "PLAN")).toEqual(planResults);
  });

  it("should normalize query keys (case-insensitive, trimmed)", () => {
    const results = [{ id: "1" }];
    cache.set("  Test Query  ", "IMPLEMENT", results);

    expect(cache.get("test query", "IMPLEMENT")).toEqual(results);
    expect(cache.get("TEST QUERY", "IMPLEMENT")).toEqual(results);
  });

  it("should return same reference on cache hit", () => {
    const results = [{ id: "1" }];
    cache.set("query", "IMPLEMENT", results);

    const hit1 = cache.get("query", "IMPLEMENT");
    const hit2 = cache.get("query", "IMPLEMENT");
    expect(hit1).toBe(hit2);
  });

  it("should invalidate all entries", () => {
    cache.set("a", "IMPLEMENT", [{ id: "1" }]);
    cache.set("b", "PLAN", [{ id: "2" }]);

    cache.invalidateAll();

    expect(cache.get("a", "IMPLEMENT")).toBeUndefined();
    expect(cache.get("b", "PLAN")).toBeUndefined();
  });

  it("should track hit and miss statistics", () => {
    cache.set("exists", "IMPLEMENT", [{ id: "1" }]);

    cache.get("exists", "IMPLEMENT"); // hit
    cache.get("missing", "IMPLEMENT"); // miss
    cache.get("exists", "PLAN"); // miss (different phase)

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
  });
});
