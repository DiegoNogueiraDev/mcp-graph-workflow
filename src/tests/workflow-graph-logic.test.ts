/**
 * Frontend logic tests for WorkflowGraph component.
 * Tests the pure logic that drives the component behavior:
 * - getVisibleNodes with expandedIds + combined filters
 * - buildChildrenMap + hierarchy interactions
 * - Layout skip optimization
 *
 * These test the ACTUAL production modules, not re-implementations.
 */
import { describe, it, expect } from "vitest";
import {
  buildChildrenMap,
  getVisibleNodes,
} from "../web/dashboard/src/lib/graph-hierarchy.js";
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

interface MockEdge {
  id: string;
  from: string;
  to: string;
  relationType: string;
  createdAt: string;
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

function makeEdge(from: string, to: string, relationType = "parent_of"): MockEdge {
  return { id: `${from}-${to}`, from, to, relationType, createdAt: "2025-01-01T00:00:00Z" };
}

// ── Simulate WorkflowGraph.visibleTableNodes logic ──
// This mirrors the exact logic in workflow-graph.tsx:
// const visible = getVisibleNodes(graph.nodes, expandedIds, childrenMap);
// return visible.filter(n => { ...status/type filters... });

function computeVisibleNodes(
  nodes: MockNode[],
  edges: MockEdge[],
  expandedIds: Set<string>,
  filterStatuses: Set<string>,
  filterTypes: Set<string>,
): MockNode[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childrenMap = buildChildrenMap(nodes as any, edges as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visible = getVisibleNodes(nodes as any, expandedIds, childrenMap) as unknown as MockNode[];
  return visible.filter((n) => {
    if (filterStatuses.size && !filterStatuses.has(n.status)) return false;
    if (filterTypes.size && !filterTypes.has(n.type)) return false;
    return true;
  });
}

// ── Tests ──

describe("WorkflowGraph visibleNodes logic (expand/collapse)", () => {
  const allNodes: MockNode[] = [
    makeNode({ id: "epic1", type: "epic", status: "in_progress" }),
    makeNode({ id: "task1", type: "task", status: "backlog", parentId: "epic1" }),
    makeNode({ id: "task2", type: "task", status: "done", parentId: "epic1" }),
    makeNode({ id: "sub1", type: "subtask", status: "done", parentId: "task1" }),
    makeNode({ id: "epic2", type: "epic", status: "ready" }),
    makeNode({ id: "task3", type: "task", status: "backlog", parentId: "epic2" }),
  ];

  it("should show only root nodes when nothing expanded (no filters)", () => {
    const result = computeVisibleNodes(allNodes, [], new Set(), new Set(), new Set());
    const ids = result.map((n) => n.id);
    expect(ids).toEqual(["epic1", "epic2"]);
  });

  it("should show children when parent is expanded", () => {
    const result = computeVisibleNodes(allNodes, [], new Set(["epic1"]), new Set(), new Set());
    const ids = result.map((n) => n.id);
    expect(ids).toEqual(["epic1", "task1", "task2", "epic2"]);
  });

  it("should expand multiple levels (DFS order)", () => {
    const result = computeVisibleNodes(allNodes, [], new Set(["epic1", "task1"]), new Set(), new Set());
    const ids = result.map((n) => n.id);
    // DFS: epic1 → task1 → sub1 → task2 → epic2
    expect(ids).toEqual(["epic1", "task1", "sub1", "task2", "epic2"]);
  });

  it("should expand all parents to show all nodes", () => {
    const result = computeVisibleNodes(
      allNodes, [], new Set(["epic1", "task1", "epic2"]), new Set(), new Set(),
    );
    expect(result).toHaveLength(6);
  });

  it("should apply status filter ON TOP of expansion", () => {
    const result = computeVisibleNodes(
      allNodes, [], new Set(["epic1"]), new Set(["done"]), new Set(),
    );
    const ids = result.map((n) => n.id);
    // Expanded: epic1, task1, task2, epic2. Filter done → task2 only
    expect(ids).toEqual(["task2"]);
  });

  it("should apply type filter ON TOP of expansion", () => {
    const result = computeVisibleNodes(
      allNodes, [], new Set(["epic1"]), new Set(), new Set(["epic"]),
    );
    const ids = result.map((n) => n.id);
    // Expanded: epic1, task1, task2, epic2. Filter epic → epic1, epic2
    expect(ids).toEqual(["epic1", "epic2"]);
  });

  it("should combine status + type filters with expansion", () => {
    const result = computeVisibleNodes(
      allNodes, [], new Set(["epic1"]), new Set(["in_progress"]), new Set(["epic"]),
    );
    const ids = result.map((n) => n.id);
    expect(ids).toEqual(["epic1"]);
  });

  it("should handle collapse all (empty expandedIds) — only roots", () => {
    const result = computeVisibleNodes(allNodes, [], new Set(), new Set(), new Set());
    expect(result).toHaveLength(2);
  });

  it("should handle empty graph gracefully", () => {
    const result = computeVisibleNodes([], [], new Set(), new Set(), new Set());
    expect(result).toEqual([]);
  });

  it("should use parent_of edges for hierarchy when parentId is absent", () => {
    const nodesNoParentId = [
      makeNode({ id: "epic1", type: "epic" }),
      makeNode({ id: "task1", type: "task" }),
    ];
    const edges = [makeEdge("epic1", "task1", "parent_of")];
    // Without expansion — task1 is a root (no parentId), so both appear
    const result1 = computeVisibleNodes(nodesNoParentId, edges, new Set(), new Set(), new Set());
    expect(result1.map((n) => n.id)).toEqual(["epic1", "task1"]);
  });

  it("should handle orphan nodes (parentId → non-existent) as roots", () => {
    const nodesWithOrphan = [
      makeNode({ id: "root1" }),
      makeNode({ id: "orphan", parentId: "deleted" }),
    ];
    const result = computeVisibleNodes(nodesWithOrphan, [], new Set(), new Set(), new Set());
    expect(result.map((n) => n.id)).toEqual(["root1", "orphan"]);
  });
});

// ── filterTopLevelNodes still works for prd-backlog-tab ──

describe("filterTopLevelNodes (backward compat for prd-backlog-tab)", () => {
  it("should still work with showFullGraph=false", () => {
    const nodes = [
      makeNode({ id: "epic1", type: "epic" }),
      makeNode({ id: "task1", type: "task", parentId: "epic1" }),
      makeNode({ id: "task2", type: "task" }),
    ];
    const result = filterTopLevelNodes(nodes, false);
    const ids = result.map((n) => n.id);
    expect(ids).toEqual(["epic1", "task2"]);
  });

  it("should still work with showFullGraph=true", () => {
    const nodes = [
      makeNode({ id: "a" }),
      makeNode({ id: "b", parentId: "a" }),
    ];
    expect(filterTopLevelNodes(nodes, true)).toHaveLength(2);
  });
});
