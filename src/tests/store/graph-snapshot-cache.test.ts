/**
 * TDD tests for GraphSnapshotCache
 * Task 2.1: In-memory cache of getAllNodes()+getAllEdges() with auto-invalidation on writes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore, type TestStoreContext } from "../helpers/test-store.js";
import { GraphSnapshotCache } from "../../core/store/graph-snapshot-cache.js";
import { generateId } from "../../core/utils/id.js";
import type { GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

describe("GraphSnapshotCache", () => {
  let ctx: TestStoreContext;
  let cache: GraphSnapshotCache;

  beforeEach(() => {
    ctx = createTestStore("SnapshotCacheTest");
    cache = new GraphSnapshotCache(ctx.store);
  });

  afterEach(() => {
    ctx.cleanup();
  });

  // ── Helper ────────────────────────────────────────────
  function addTestNode(title: string = "Test Node"): GraphNode {
    const node: GraphNode = {
      id: generateId("node"),
      type: "task",
      title,
      description: "test",
      status: "backlog",
      priority: 3,
      blocked: false,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ctx.store.insertNode(node);
    return node;
  }

  function addTestEdge(from: string, to: string): GraphEdge {
    const edge: GraphEdge = {
      id: generateId("edge"),
      from,
      to,
      relationType: "depends_on",
      createdAt: new Date().toISOString(),
    };
    ctx.store.insertEdge(edge);
    return edge;
  }

  // ── AC 1: Cache returns snapshot without SQLite query on consecutive reads ──

  describe("cache hit on consecutive reads", () => {
    it("should return same snapshot reference on consecutive getCachedSnapshot calls", () => {
      addTestNode("Node A");
      addTestNode("Node B");

      const snap1 = cache.getCachedSnapshot();
      const snap2 = cache.getCachedSnapshot();

      // Same reference = cache hit (no re-query)
      expect(snap1).toBe(snap2);
      expect(snap1.nodes).toHaveLength(2);
      expect(snap1.edges).toHaveLength(0);
    });

    it("should return nodes and edges in the snapshot", () => {
      const nodeA = addTestNode("Node A");
      const nodeB = addTestNode("Node B");
      addTestEdge(nodeA.id, nodeB.id);

      const snap = cache.getCachedSnapshot();

      expect(snap.nodes).toHaveLength(2);
      expect(snap.edges).toHaveLength(1);
      expect(snap.nodes.map((n) => n.title)).toContain("Node A");
      expect(snap.nodes.map((n) => n.title)).toContain("Node B");
      expect(snap.edges[0].from).toBe(nodeA.id);
      expect(snap.edges[0].to).toBe(nodeB.id);
    });
  });

  // ── AC 2: Any write invalidates cache automatically ──

  describe("auto-invalidation on writes", () => {
    it("should invalidate cache after insertNode", () => {
      addTestNode("Node A");
      const snap1 = cache.getCachedSnapshot();
      expect(snap1.nodes).toHaveLength(1);

      addTestNode("Node B");
      cache.invalidate();

      const snap2 = cache.getCachedSnapshot();
      expect(snap2).not.toBe(snap1);
      expect(snap2.nodes).toHaveLength(2);
    });

    it("should invalidate cache after updateNode", () => {
      const node = addTestNode("Original");
      const snap1 = cache.getCachedSnapshot();
      expect(snap1.nodes[0].title).toBe("Original");

      ctx.store.updateNode(node.id, { title: "Updated" });
      cache.invalidate();

      const snap2 = cache.getCachedSnapshot();
      expect(snap2).not.toBe(snap1);
      expect(snap2.nodes[0].title).toBe("Updated");
    });

    it("should invalidate cache after deleteNode", () => {
      const node = addTestNode("ToDelete");
      const snap1 = cache.getCachedSnapshot();
      expect(snap1.nodes).toHaveLength(1);

      ctx.store.deleteNode(node.id);
      cache.invalidate();

      const snap2 = cache.getCachedSnapshot();
      expect(snap2).not.toBe(snap1);
      expect(snap2.nodes).toHaveLength(0);
    });

    it("should invalidate cache after insertEdge", () => {
      const nodeA = addTestNode("A");
      const nodeB = addTestNode("B");
      const snap1 = cache.getCachedSnapshot();
      expect(snap1.edges).toHaveLength(0);

      addTestEdge(nodeA.id, nodeB.id);
      cache.invalidate();

      const snap2 = cache.getCachedSnapshot();
      expect(snap2).not.toBe(snap1);
      expect(snap2.edges).toHaveLength(1);
    });

    it("should invalidate cache after deleteEdge", () => {
      const nodeA = addTestNode("A");
      const nodeB = addTestNode("B");
      const edge = addTestEdge(nodeA.id, nodeB.id);
      const snap1 = cache.getCachedSnapshot();
      expect(snap1.edges).toHaveLength(1);

      ctx.store.deleteEdge(edge.id);
      cache.invalidate();

      const snap2 = cache.getCachedSnapshot();
      expect(snap2).not.toBe(snap1);
      expect(snap2.edges).toHaveLength(0);
    });
  });

  // ── AC 4: Cache stats ──

  describe("cache statistics", () => {
    it("should track hits and misses", () => {
      addTestNode("Node");

      // First call = miss (populate cache)
      cache.getCachedSnapshot();
      // Second call = hit
      cache.getCachedSnapshot();
      // Third call = hit
      cache.getCachedSnapshot();

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it("should reset stats after invalidation", () => {
      addTestNode("Node");
      cache.getCachedSnapshot();
      cache.getCachedSnapshot();

      cache.invalidate();
      cache.getCachedSnapshot();

      const stats = cache.getStats();
      // After invalidate: previous stats preserved, new miss counted
      expect(stats.misses).toBe(2); // initial miss + post-invalidate miss
      expect(stats.hits).toBe(1);   // one hit before invalidate
    });
  });
});
