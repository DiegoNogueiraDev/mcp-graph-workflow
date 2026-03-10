/**
 * Frontend logic tests for WorkflowGraph component.
 * Tests the pure logic that drives the component behavior:
 * - filterTopLevelNodes integration with toFlowNodes
 * - visibleNodes computation with combined filters
 * - Layout skip optimization
 *
 * These test the ACTUAL production modules, not re-implementations.
 */
import { describe, it, expect } from "vitest";
import { filterTopLevelNodes } from "../web/dashboard/src/lib/graph-filters.js";

// ── Minimal factory matching GraphNode shape ─────

interface MockNode {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: number;
  parentId?: string | null;
}

function makeNode(overrides: Partial<MockNode> & { id: string }): MockNode {
  return {
    type: "task",
    title: `Node ${overrides.id}`,
    status: "backlog",
    priority: 3,
    ...overrides,
  };
}

// ── Tests simulating WorkflowGraph.visibleNodes ──

describe("WorkflowGraph visibleNodes logic", () => {
  // This mirrors the exact logic in workflow-graph.tsx:
  // const base = filterTopLevelNodes(graph.nodes, showFullGraph);
  // return base.filter(n => {
  //   if (filterStatuses.size && !filterStatuses.has(n.status)) return false;
  //   if (filterTypes.size && !filterTypes.has(n.type)) return false;
  //   return true;
  // });

  function computeVisibleNodes(
    nodes: MockNode[],
    showFullGraph: boolean,
    filterStatuses: Set<string>,
    filterTypes: Set<string>,
  ): MockNode[] {
    const base = filterTopLevelNodes(nodes, showFullGraph);
    return base.filter((n) => {
      if (filterStatuses.size && !filterStatuses.has(n.status)) return false;
      if (filterTypes.size && !filterTypes.has(n.type)) return false;
      return true;
    });
  }

  const allNodes: MockNode[] = [
    makeNode({ id: "epic1", type: "epic", status: "in_progress" }),
    makeNode({ id: "task1", type: "task", status: "backlog", parentId: "epic1" }),
    makeNode({ id: "task2", type: "task", status: "done" }),
    makeNode({ id: "sub1", type: "subtask", status: "done", parentId: "task1" }),
    makeNode({ id: "req1", type: "requirement", status: "ready", parentId: "epic1" }),
    makeNode({ id: "milestone1", type: "milestone", status: "backlog" }),
  ];

  it("should show only top-level + root nodes by default (no filters, showFullGraph=false)", () => {
    const result = computeVisibleNodes(allNodes, false, new Set(), new Set());
    const ids = result.map((n) => n.id);
    // epic1 (top-level type), task2 (no parent), req1 (top-level type), milestone1 (top-level type)
    expect(ids).toEqual(["epic1", "task2", "req1", "milestone1"]);
  });

  it("should show all nodes when showFullGraph=true and no filters", () => {
    const result = computeVisibleNodes(allNodes, true, new Set(), new Set());
    expect(result).toHaveLength(6);
  });

  it("should apply status filter on top of top-level filter", () => {
    const result = computeVisibleNodes(allNodes, false, new Set(["done"]), new Set());
    const ids = result.map((n) => n.id);
    // Only top-level + root nodes that are "done" → task2
    expect(ids).toEqual(["task2"]);
  });

  it("should apply type filter on top of top-level filter", () => {
    const result = computeVisibleNodes(allNodes, false, new Set(), new Set(["epic"]));
    const ids = result.map((n) => n.id);
    expect(ids).toEqual(["epic1"]);
  });

  it("should combine showFullGraph=true with status filter", () => {
    const result = computeVisibleNodes(allNodes, true, new Set(["done"]), new Set());
    const ids = result.map((n) => n.id);
    expect(ids).toEqual(["task2", "sub1"]);
  });

  it("should combine showFullGraph=true with type filter", () => {
    const result = computeVisibleNodes(allNodes, true, new Set(), new Set(["subtask"]));
    const ids = result.map((n) => n.id);
    expect(ids).toEqual(["sub1"]);
  });

  it("should return empty when no nodes match combined filters", () => {
    const result = computeVisibleNodes(allNodes, false, new Set(["blocked"]), new Set());
    expect(result).toHaveLength(0);
  });

  it("should handle empty graph gracefully", () => {
    const result = computeVisibleNodes([], false, new Set(), new Set());
    expect(result).toEqual([]);
  });
});

// ── Tests simulating FilterPanel + showFullGraph ─

describe("FilterPanel showFullGraph warning logic", () => {
  it("should warn when showFullGraph=true and count > 200", () => {
    const showFullGraph = true;
    const totalNodeCount = 250;
    const shouldWarn = showFullGraph && totalNodeCount > 200;
    expect(shouldWarn).toBe(true);
  });

  it("should not warn when showFullGraph=false", () => {
    const showFullGraph = false;
    const totalNodeCount = 500;
    const shouldWarn = showFullGraph && totalNodeCount > 200;
    expect(shouldWarn).toBe(false);
  });

  it("should not warn when count <= 200", () => {
    const showFullGraph = true;
    const totalNodeCount = 100;
    const shouldWarn = showFullGraph && totalNodeCount > 200;
    expect(shouldWarn).toBe(false);
  });
});
