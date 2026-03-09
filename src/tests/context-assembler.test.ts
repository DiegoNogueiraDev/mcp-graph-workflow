import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { assembleContext } from "../core/context/context-assembler.js";
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

describe("ContextAssembler", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty sections when no data exists", () => {
    const ctx = assembleContext(store, "nonexistent query");

    expect(ctx.query).toBe("nonexistent query");
    expect(ctx.sections).toHaveLength(0);
    expect(ctx.tokenUsage.used).toBe(0);
  });

  it("should assemble context with graph nodes", () => {
    const node = makeNode({ title: "Build REST API", description: "Express routes" });
    store.insertNode(node);

    const ctx = assembleContext(store, "REST API", { nodeIds: [node.id] });

    expect(ctx.sections.length).toBeGreaterThanOrEqual(1);
    expect(ctx.sections[0].source).toBe("graph");
    expect(ctx.tokenUsage.used).toBeGreaterThan(0);
    expect(ctx.tokenUsage.breakdown.graph).toBeGreaterThan(0);
  });

  it("should include knowledge in assembled context", () => {
    const node = makeNode({ title: "Setup SQLite database" });
    store.insertNode(node);

    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "docs",
      sourceId: "sqlite-docs",
      title: "SQLite Guide",
      content: "SQLite is a lightweight database engine for local storage",
    });

    const ctx = assembleContext(store, "SQLite database", { nodeIds: [node.id] });

    const knowledgeSections = ctx.sections.filter((s) => s.source === "knowledge");
    expect(knowledgeSections.length).toBeGreaterThanOrEqual(1);
    expect(ctx.tokenUsage.breakdown.knowledge).toBeGreaterThan(0);
  });

  it("should respect token budget", () => {
    // Add many nodes
    for (let i = 0; i < 10; i++) {
      store.insertNode(makeNode({ title: `Task ${i}: Implementation detail number ${i}` }));
    }

    const nodeIds = store.getAllNodes().map((n) => n.id);
    const ctx = assembleContext(store, "implementation", {
      nodeIds,
      tokenBudget: 200,
    });

    expect(ctx.tokenUsage.used).toBeLessThanOrEqual(ctx.tokenUsage.budget + 100); // small tolerance
  });

  it("should support all tier levels", () => {
    const node = makeNode({ title: "Test node" });
    store.insertNode(node);

    const summary = assembleContext(store, "test", { nodeIds: [node.id], tier: "summary" });
    const standard = assembleContext(store, "test", { nodeIds: [node.id], tier: "standard" });
    const deep = assembleContext(store, "test", { nodeIds: [node.id], tier: "deep" });

    expect(summary.tier).toBe("summary");
    expect(standard.tier).toBe("standard");
    expect(deep.tier).toBe("deep");

    // Summary should use fewer tokens than standard
    expect(summary.tokenUsage.used).toBeLessThanOrEqual(standard.tokenUsage.used);
  });

  it("should include token breakdown", () => {
    const node = makeNode({ title: "API endpoint" });
    store.insertNode(node);

    const ctx = assembleContext(store, "API", { nodeIds: [node.id] });

    expect(ctx.tokenUsage.breakdown).toHaveProperty("graph");
    expect(ctx.tokenUsage.breakdown).toHaveProperty("knowledge");
    expect(ctx.tokenUsage.budget).toBe(4000);
    expect(ctx.tokenUsage.remaining).toBe(ctx.tokenUsage.budget - ctx.tokenUsage.used);
  });
});
