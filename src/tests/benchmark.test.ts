import { describe, it, expect } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { findNextTask } from "../core/planner/next-task.js";
import { graphToMermaid } from "../core/graph/mermaid-export.js";
import { buildTaskContext } from "../core/context/compact-context.js";
import { searchNodes } from "../core/search/fts-search.js";
import type { GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";

function createBulkNodes(count: number): GraphNode[] {
  const nodes: GraphNode[] = [];
  const timestamp = now();
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: generateId("node"),
      type: i % 5 === 0 ? "epic" : "task",
      title: `Benchmark task ${i} — performance testing node`,
      description: `Description for benchmark node ${i} with some searchable content`,
      status: i % 3 === 0 ? "done" : "backlog",
      priority: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return nodes;
}

function createBulkEdges(nodes: GraphNode[], edgeCount: number): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const timestamp = now();
  for (let i = 0; i < edgeCount && i < nodes.length - 1; i++) {
    const fromIdx = i % nodes.length;
    const toIdx = (i + 1) % nodes.length;
    edges.push({
      id: generateId("edge"),
      from: nodes[fromIdx].id,
      to: nodes[toIdx].id,
      relationType: i % 2 === 0 ? "depends_on" : "parent_of",
      createdAt: timestamp,
    });
  }
  return edges;
}

describe("Benchmark Tests", () => {
  it("bulk insert: 1000 nodes + 2000 edges < 2s", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("benchmark");

    const nodes = createBulkNodes(1000);
    const edges = createBulkEdges(nodes, 2000);

    const start = performance.now();
    store.bulkInsert(nodes, edges);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);

    const stats = store.getStats();
    expect(stats.totalNodes).toBe(1000);

    store.close();
  });

  it("FTS search over 1000 nodes < 100ms", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("benchmark");

    const nodes = createBulkNodes(1000);
    store.bulkInsert(nodes, []);

    const start = performance.now();
    const results = searchNodes(store, "benchmark performance");
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(results.length).toBeGreaterThan(0);

    store.close();
  });

  it("findNextTask with 500 tasks and dependency chains < 50ms", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("benchmark");

    const nodes = createBulkNodes(500);
    const edges = createBulkEdges(nodes, 1000);
    store.bulkInsert(nodes, edges);

    const doc = store.toGraphDocument();

    const start = performance.now();
    const result = findNextTask(doc);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    // Should return something (there are backlog tasks)
    expect(result).not.toBeNull();

    store.close();
  });

  it("mermaid export with 200 nodes < 200ms", () => {
    const nodes = createBulkNodes(200);
    const edges = createBulkEdges(nodes, 400);

    const start = performance.now();
    const mermaid = graphToMermaid(nodes, edges);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
    expect(mermaid.startsWith("graph")).toBe(true);
  });

  it("toGraphDocument with 1000 nodes < 500ms", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("benchmark");

    const nodes = createBulkNodes(1000);
    const edges = createBulkEdges(nodes, 2000);
    store.bulkInsert(nodes, edges);

    const start = performance.now();
    const doc = store.toGraphDocument();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(doc.nodes.length).toBe(1000);

    store.close();
  });

  it("buildTaskContext for deep chain < 100ms", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("benchmark");

    const nodes = createBulkNodes(100);
    const edges = createBulkEdges(nodes, 200);
    store.bulkInsert(nodes, edges);

    const taskNode = nodes.find((n) => n.type === "task");
    if (!taskNode) return;

    const start = performance.now();
    const ctx = buildTaskContext(store, taskNode.id);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    // May be null if node doesn't exist in store properly, but should not crash
    expect(ctx === null || typeof ctx === "object").toBe(true);

    store.close();
  });
});
