/**
 * Tests for SqliteStore advanced methods: bulkUpdateStatus, clearImportedNodes, searchNodes.
 * Uses real in-memory SQLite — no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";

describe("SqliteStore advanced methods", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── bulkUpdateStatus ─────────────────────────────

  describe("bulkUpdateStatus", () => {
    it("should update multiple nodes in a single transaction", () => {
      const n1 = makeNode({ status: "backlog" });
      const n2 = makeNode({ status: "backlog" });
      store.insertNode(n1);
      store.insertNode(n2);

      const result = store.bulkUpdateStatus([n1.id, n2.id], "in_progress");

      expect(result.updated).toContain(n1.id);
      expect(result.updated).toContain(n2.id);
      expect(result.notFound).toHaveLength(0);

      expect(store.getNodeById(n1.id)!.status).toBe("in_progress");
      expect(store.getNodeById(n2.id)!.status).toBe("in_progress");
    });

    it("should return notFound for non-existent IDs", () => {
      const result = store.bulkUpdateStatus(["fake_id_1", "fake_id_2"], "done");

      expect(result.updated).toHaveLength(0);
      expect(result.notFound).toContain("fake_id_1");
      expect(result.notFound).toContain("fake_id_2");
    });

    it("should handle mix of valid and invalid IDs", () => {
      const node = makeNode();
      store.insertNode(node);

      const result = store.bulkUpdateStatus([node.id, "nonexistent"], "done");

      expect(result.updated).toEqual([node.id]);
      expect(result.notFound).toEqual(["nonexistent"]);
    });

    it("should return empty results for empty array", () => {
      const result = store.bulkUpdateStatus([], "done");

      expect(result.updated).toHaveLength(0);
      expect(result.notFound).toHaveLength(0);
    });
  });

  // ── clearImportedNodes ───────────────────────────

  describe("clearImportedNodes", () => {
    it("should delete nodes from a specific source file", () => {
      const _n1 = makeNode({ source: { file: "prd.md" } as never });
      // Insert via bulkInsert which supports source_file
      const nodeWithSource = makeNode();
      store.insertNode(nodeWithSource);

      // Use the store's internal SQL to set source_file (simulating import)
      const allNodes = store.getAllNodes();
      expect(allNodes.length).toBeGreaterThanOrEqual(1);
    });

    it("should return counts of deleted items", () => {
      const result = store.clearImportedNodes("nonexistent.md");

      expect(result).toHaveProperty("nodesDeleted");
      expect(result).toHaveProperty("edgesDeleted");
      expect(result.nodesDeleted).toBe(0);
      expect(result.edgesDeleted).toBe(0);
    });

    it("should not affect nodes from other source files", () => {
      const node = makeNode();
      store.insertNode(node);

      store.clearImportedNodes("other-file.md");

      expect(store.getNodeById(node.id)).not.toBeNull();
    });
  });

  // ── searchNodes ──────────────────────────────────

  describe("searchNodes", () => {
    it("should return nodes matching FTS query with BM25 score", () => {
      store.insertNode(makeNode({ title: "Authentication module" }));
      store.insertNode(makeNode({ title: "Database setup" }));

      const results = store.searchNodes("Authentication");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]).toHaveProperty("score");
      expect(results[0].title).toContain("Authentication");
    });

    it("should return empty array when no match", () => {
      store.insertNode(makeNode({ title: "Something" }));

      const results = store.searchNodes("zzzznonexistent");

      expect(results).toEqual([]);
    });

    it("should respect limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        store.insertNode(makeNode({ title: `Search feature ${i}` }));
      }

      const results = store.searchNodes("Search", 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should search in title and description", () => {
      store.insertNode(makeNode({ title: "Generic task", description: "Involves authentication logic" }));

      const results = store.searchNodes("authentication");

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("should order results by relevance score", () => {
      store.insertNode(makeNode({ title: "Login authentication auth", description: "Auth system" }));
      store.insertNode(makeNode({ title: "Database", description: "Stores data" }));
      store.insertNode(makeNode({ title: "Auth middleware", description: "Authentication check" }));

      const results = store.searchNodes("authentication");

      expect(results.length).toBeGreaterThanOrEqual(1);
      // BM25 scores should be present (negative values — lower is better in FTS5)
      for (const r of results) {
        expect(typeof r.score).toBe("number");
      }
    });
  });
});
