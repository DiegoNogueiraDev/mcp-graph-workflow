/**
 * TDD tests for extending cache to detail + default RAG paths.
 * Task 3.2: All 3 RAG paths should use caching.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ResponseCache } from "../../core/rag/response-cache.js";

describe("ResponseCache for RAG paths", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ ttlMs: 2 * 60 * 1000, maxSize: 50 });
  });

  it("should cache results with strategy:query:budget key format", () => {
    const key = "default:test query:4000";
    const result = { sections: [{ name: "node:test" }], tokenUsage: { used: 100 } };

    cache.set(key, result);
    const cached = cache.get(key);

    expect(cached).toEqual(result);
  });

  it("should cache detail path with tier in key", () => {
    const key = "detail:test query:deep";
    const result = { sections: [{ name: "node:detail" }] };

    cache.set(key, result);
    expect(cache.get(key)).toEqual(result);
  });

  it("should differentiate keys by strategy", () => {
    cache.set("default:query:4000", { type: "default" });
    cache.set("detail:query:standard", { type: "detail" });
    cache.set("multi:query:4000", { type: "multi" });

    expect(cache.get("default:query:4000")).toEqual({ type: "default" });
    expect(cache.get("detail:query:standard")).toEqual({ type: "detail" });
    expect(cache.get("multi:query:4000")).toEqual({ type: "multi" });
  });

  it("should return same reference on cache hit (no re-computation)", () => {
    const result = { sections: [] };
    cache.set("key", result);

    const hit1 = cache.get("key");
    const hit2 = cache.get("key");
    expect(hit1).toBe(hit2);
  });

  it("should track stats across all paths", () => {
    cache.set("default:a:4000", { d: 1 });
    cache.set("detail:b:deep", { d: 2 });

    cache.get("default:a:4000"); // hit
    cache.get("detail:b:deep");  // hit
    cache.get("multi:c:4000");   // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(2);
  });

  it("should invalidate all paths at once", () => {
    cache.set("default:a:4000", { d: 1 });
    cache.set("detail:b:deep", { d: 2 });

    cache.invalidateAll();

    expect(cache.get("default:a:4000")).toBeUndefined();
    expect(cache.get("detail:b:deep")).toBeUndefined();
    expect(cache.getStats().size).toBe(0);
  });
});
