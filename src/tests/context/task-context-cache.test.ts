/**
 * TDD tests for TaskContextCache.
 * Task 5.1: Cache buildTaskContext result per nodeId.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TaskContextCache } from "../../core/context/task-context-cache.js";
import type { TaskContext } from "../../core/context/compact-context.js";

function makeContext(nodeId: string, title: string): TaskContext {
  return {
    task: { id: nodeId, type: "task", title, status: "backlog", priority: 3 },
    node: { id: nodeId, type: "task", title, status: "backlog", priority: 3 },
    parent: null,
    children: [],
    blockers: [],
    dependsOn: [],
    acceptanceCriteria: [],
    sourceRef: null,
    metrics: { originalChars: 100, compactChars: 50, reductionPercent: 50, estimatedTokens: 13 },
  };
}

describe("TaskContextCache", () => {
  let cache: TaskContextCache;

  beforeEach(() => {
    cache = new TaskContextCache({ maxSize: 50, ttlMs: 3 * 60 * 1000 });
  });

  it("should return undefined for cache miss", () => {
    expect(cache.get("unknown-node")).toBeUndefined();
  });

  it("should cache and retrieve context by nodeId", () => {
    const ctx = makeContext("node_1", "Task 1");
    cache.set("node_1", ctx);

    const cached = cache.get("node_1");
    expect(cached).toBeDefined();
    expect(cached!.task.title).toBe("Task 1");
  });

  it("should return same reference on cache hit (no re-computation)", () => {
    const ctx = makeContext("node_1", "Task 1");
    cache.set("node_1", ctx);

    const hit1 = cache.get("node_1");
    const hit2 = cache.get("node_1");
    expect(hit1).toBe(hit2);
  });

  it("should return from cache on 10 consecutive calls = 1 miss + 9 hits", () => {
    const ctx = makeContext("node_1", "Task 1");
    cache.set("node_1", ctx);

    for (let i = 0; i < 10; i++) {
      expect(cache.get("node_1")).toBe(ctx);
    }

    const stats = cache.getStats();
    expect(stats.hits).toBe(10);
  });

  it("should invalidate cache for a specific node", () => {
    cache.set("node_1", makeContext("node_1", "Task 1"));
    cache.set("node_2", makeContext("node_2", "Task 2"));

    cache.invalidateNode("node_1");

    expect(cache.get("node_1")).toBeUndefined();
    expect(cache.get("node_2")).toBeDefined();
  });

  it("should invalidate node and its dependents", () => {
    cache.set("node_1", makeContext("node_1", "Task 1"));
    cache.set("node_2", makeContext("node_2", "Task 2"));
    cache.set("node_3", makeContext("node_3", "Task 3"));

    // Invalidate node_1 + dependents [node_2]
    cache.invalidateNodeAndDependents("node_1", ["node_2"]);

    expect(cache.get("node_1")).toBeUndefined();
    expect(cache.get("node_2")).toBeUndefined();
    expect(cache.get("node_3")).toBeDefined(); // not a dependent
  });

  it("should invalidate all entries", () => {
    cache.set("node_1", makeContext("node_1", "A"));
    cache.set("node_2", makeContext("node_2", "B"));

    cache.invalidateAll();

    expect(cache.get("node_1")).toBeUndefined();
    expect(cache.get("node_2")).toBeUndefined();
  });

  it("should track hit and miss statistics", () => {
    cache.set("node_1", makeContext("node_1", "A"));

    cache.get("node_1"); // hit
    cache.get("node_2"); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });
});
