import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { buildTieredContext } from "../core/context/tiered-context.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeNode(overrides?: Partial<GraphNode>): GraphNode {
  const ts = now();
  return {
    id: generateId("node"),
    type: "task",
    title: "Default task",
    status: "backlog",
    priority: 3,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe("TieredContext", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return null for non-existent node", () => {
    const result = buildTieredContext(store, "node_nonexistent");
    expect(result).toBeNull();
  });

  // ── Tier 1: Summary ──────────────────────────

  describe("tier: summary", () => {
    it("should return minimal summary (~20 tokens)", () => {
      const node = makeNode({ title: "Setup database" });
      store.insertNode(node);

      const ctx = buildTieredContext(store, node.id, "summary");

      expect(ctx).not.toBeNull();
      expect(ctx!.tier).toBe("summary");
      expect(ctx!.summary.title).toBe("Setup database");
      expect(ctx!.taskContext).toBeUndefined();
      expect(ctx!.knowledgeSnippets).toBeUndefined();
      expect(ctx!.estimatedTokens).toBeLessThan(50);
    });
  });

  // ── Tier 2: Standard ─────────────────────────

  describe("tier: standard", () => {
    it("should return task context (~150 tokens)", () => {
      const node = makeNode({ title: "Build API endpoints", description: "REST API with Express" });
      store.insertNode(node);

      const ctx = buildTieredContext(store, node.id, "standard");

      expect(ctx).not.toBeNull();
      expect(ctx!.tier).toBe("standard");
      expect(ctx!.taskContext).toBeDefined();
      expect(ctx!.taskContext!.task.title).toBe("Build API endpoints");
      expect(ctx!.knowledgeSnippets).toBeUndefined();
      expect(ctx!.estimatedTokens).toBeGreaterThan(20);
    });

    it("should include edge relationships", () => {
      const parent = makeNode({ title: "Epic: Backend", type: "epic" });
      const child = makeNode({ title: "Database layer", parentId: parent.id });
      store.insertNode(parent);
      store.insertNode(child);

      const ctx = buildTieredContext(store, parent.id, "standard");

      expect(ctx!.taskContext!.children.length).toBe(1);
    });
  });

  // ── Tier 3: Deep ─────────────────────────────

  describe("tier: deep", () => {
    it("should return full context with knowledge", () => {
      const node = makeNode({ title: "Implement REST API", tags: ["api", "express"] });
      store.insertNode(node);

      // Add some knowledge docs
      const knowledgeStore = new KnowledgeStore(store.getDb());
      knowledgeStore.insert({
        sourceType: "docs",
        sourceId: "express-docs",
        title: "Express Guide",
        content: "Express is a web framework for building REST APIs",
      });

      const ctx = buildTieredContext(store, node.id, "deep");

      expect(ctx).not.toBeNull();
      expect(ctx!.tier).toBe("deep");
      expect(ctx!.taskContext).toBeDefined();
      expect(ctx!.knowledgeSnippets).toBeDefined();
      expect(ctx!.knowledgeSnippets!.length).toBeGreaterThanOrEqual(1);
      expect(ctx!.estimatedTokens).toBeGreaterThan(50);
    });

    it("should work without knowledge docs", () => {
      const node = makeNode({ title: "Simple task" });
      store.insertNode(node);

      const ctx = buildTieredContext(store, node.id, "deep");

      expect(ctx).not.toBeNull();
      expect(ctx!.tier).toBe("deep");
      expect(ctx!.taskContext).toBeDefined();
      // knowledgeSnippets may be undefined if no matches
    });
  });

  // ── Token estimates ───────────────────────────

  describe("token ordering", () => {
    it("should produce increasing tokens: summary < standard < deep", () => {
      const node = makeNode({ title: "Build search engine", description: "FTS5 search with BM25 ranking" });
      store.insertNode(node);

      const knowledgeStore = new KnowledgeStore(store.getDb());
      knowledgeStore.insert({
        sourceType: "upload",
        sourceId: "f1",
        title: "Search Architecture",
        content: "Full-text search with BM25 ranking and TF-IDF reranking",
      });

      const summary = buildTieredContext(store, node.id, "summary")!;
      const standard = buildTieredContext(store, node.id, "standard")!;
      const deep = buildTieredContext(store, node.id, "deep")!;

      expect(summary.estimatedTokens).toBeLessThan(standard.estimatedTokens);
      expect(standard.estimatedTokens).toBeLessThanOrEqual(deep.estimatedTokens);
    });
  });

  // ── Default tier ──────────────────────────────

  it("should default to standard tier", () => {
    const node = makeNode({ title: "Test task" });
    store.insertNode(node);

    const ctx = buildTieredContext(store, node.id);
    expect(ctx!.tier).toBe("standard");
  });
});
