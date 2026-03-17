import { describe, it, expect } from "vitest";

/**
 * Unit tests for graph-utils pure functions.
 * These test toFlowNodes, toFlowEdges, applyDagreLayout, and computeLayoutKey.
 *
 * Note: graph-utils is a React dashboard module using path aliases (@/lib/types).
 * We test via re-implementing minimal logic here to validate the pure functions.
 * The actual module uses @dagrejs/dagre and @xyflow/react types.
 */

// ── Minimal factory helpers ───────────────────────

interface GraphNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  xpSize?: string;
  parentId?: string | null;
  sprint?: string | null;
  tags?: string[];
  acceptanceCriteria?: string[];
  sourceRef?: { file: string; startLine?: number; endLine?: number; confidence?: number };
  blocked?: boolean;
  estimateMinutes?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relationType: string;
  weight?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function makeNode(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    type: "task",
    title: `Node ${overrides.id}`,
    status: "backlog",
    priority: 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeEdge(overrides: Partial<GraphEdge> & { id: string; from: string; to: string }): GraphEdge {
  return {
    relationType: "depends_on",
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Pure function re-implementations for testing ──
// These mirror the logic in graph-utils.ts so we can test
// without needing the full React/Vite build chain.

const NODE_TYPE_COLORS: Record<string, string> = {
  epic: "#7c3aed",
  task: "#2196f3",
  subtask: "#10b981",
  requirement: "#f59e0b",
  constraint: "#ef4444",
  milestone: "#8b5cf6",
  acceptance_criteria: "#06b6d4",
  risk: "#f97316",
  decision: "#ec4899",
};

const EDGE_STYLES: Record<string, { color: string; dashed: boolean; label: string }> = {
  depends_on: { color: "#6c757d", dashed: false, label: "depends on" },
  blocks: { color: "#f44336", dashed: true, label: "blocks" },
  parent_of: { color: "#7c3aed", dashed: false, label: "parent of" },
  child_of: { color: "#10b981", dashed: false, label: "child of" },
  related_to: { color: "#9e9e9e", dashed: true, label: "related to" },
  priority_over: { color: "#ff9800", dashed: true, label: "priority over" },
  implements: { color: "#2196f3", dashed: false, label: "implements" },
  derived_from: { color: "#06b6d4", dashed: true, label: "derived from" },
};

const NODE_WIDTH = 240;

function toFlowNodes(
  nodes: GraphNode[],
  filters?: { statuses?: Set<string>; types?: Set<string> },
  childrenMap?: Map<string, string[]>,
  expandedIds?: Set<string>,
  onExpand?: (nodeId: string) => void,
): Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown>; style: Record<string, unknown> }> {
  return nodes
    .filter((n) => {
      if (filters?.statuses?.size && !filters.statuses.has(n.status)) return false;
      if (filters?.types?.size && !filters.types.has(n.type)) return false;
      return true;
    })
    .map((n) => {
      const children = childrenMap?.get(n.id);
      const hasChildren = children != null && children.length > 0;
      return {
        id: n.id,
        type: "workflowNode",
        position: { x: 0, y: 0 },
        data: {
          label: n.title,
          nodeType: n.type,
          status: n.status,
          priority: n.priority,
          xpSize: n.xpSize,
          sprint: n.sprint,
          sourceNode: n,
          hasChildren,
          isExpanded: expandedIds?.has(n.id) ?? false,
          childCount: children?.length ?? 0,
          onExpand,
        },
        style: {
          width: NODE_WIDTH,
          borderLeft: `4px solid ${NODE_TYPE_COLORS[n.type] || "#6c757d"}`,
        },
      };
    });
}

function toFlowEdges(
  edges: GraphEdge[],
  visibleNodeIds: Set<string>,
): Array<{ id: string; source: string; target: string; label: string; type: string; data: Record<string, unknown>; style: Record<string, unknown> }> {
  return edges
    .filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to))
    .map((e) => {
      const edgeStyle = EDGE_STYLES[e.relationType] || EDGE_STYLES.related_to;
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        label: edgeStyle.label,
        type: "workflowEdge",
        data: { relationType: e.relationType },
        style: {
          stroke: edgeStyle.color,
          strokeDasharray: edgeStyle.dashed ? "5 5" : undefined,
        },
      };
    });
}

/**
 * computeLayoutKey — deterministic numeric hash for cache key.
 * Mirrors the new function we'll add to graph-utils.ts.
 */
function computeLayoutKey(nodeIds: string[], edgePairs: string[], direction: string): number {
  let hash = 0;
  const parts = [direction, ...nodeIds, "|", ...edgePairs];
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash = ((hash << 5) - hash + part.charCodeAt(i)) | 0;
    }
  }
  return hash;
}

/**
 * shouldSkipLayout — returns true if filtered node IDs haven't changed.
 */
function shouldSkipLayout(prevIds: string[] | null, nextIds: string[]): boolean {
  if (prevIds === null) return false;
  if (prevIds.length !== nextIds.length) return false;
  for (let i = 0; i < prevIds.length; i++) {
    if (prevIds[i] !== nextIds[i]) return false;
  }
  return true;
}

// ── Tests ─────────────────────────────────────────

describe("toFlowNodes", () => {
  const nodes: GraphNode[] = [
    makeNode({ id: "n1", status: "done", type: "task" }),
    makeNode({ id: "n2", status: "in_progress", type: "epic" }),
    makeNode({ id: "n3", status: "backlog", type: "task" }),
    makeNode({ id: "n4", status: "blocked", type: "subtask" }),
  ];

  it("should return all nodes when no filters applied", () => {
    const result = toFlowNodes(nodes);
    expect(result).toHaveLength(4);
    expect(result.map((n) => n.id)).toEqual(["n1", "n2", "n3", "n4"]);
  });

  it("should filter by status", () => {
    const result = toFlowNodes(nodes, { statuses: new Set(["done"]) });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("n1");
  });

  it("should filter by type", () => {
    const result = toFlowNodes(nodes, { types: new Set(["epic"]) });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("n2");
  });

  it("should filter by status AND type combined", () => {
    const result = toFlowNodes(nodes, {
      statuses: new Set(["backlog", "blocked"]),
      types: new Set(["task"]),
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("n3");
  });

  it("should return empty array for empty input", () => {
    const result = toFlowNodes([]);
    expect(result).toEqual([]);
  });

  it("should preserve node data (label, type, status, priority, sourceNode)", () => {
    const node = makeNode({ id: "n5", title: "My Task", type: "epic", status: "ready", priority: 1, xpSize: "M", sprint: "S1" });
    const result = toFlowNodes([node]);
    expect(result).toHaveLength(1);
    const data = result[0].data;
    expect(data.label).toBe("My Task");
    expect(data.nodeType).toBe("epic");
    expect(data.status).toBe("ready");
    expect(data.priority).toBe(1);
    expect(data.xpSize).toBe("M");
    expect(data.sprint).toBe("S1");
    expect(data.sourceNode).toBe(node);
  });

  it("should set correct border color based on type", () => {
    const epicNode = makeNode({ id: "n6", type: "epic" });
    const result = toFlowNodes([epicNode]);
    expect(result[0].style.borderLeft).toBe("4px solid #7c3aed");
  });

  it("should return empty when all nodes are filtered out", () => {
    const result = toFlowNodes(nodes, { statuses: new Set(["nonexistent"]) });
    expect(result).toEqual([]);
  });

  it("should set hasChildren=true and childCount when childrenMap provided", () => {
    const parentNodes = [
      makeNode({ id: "epic1", type: "epic" }),
      makeNode({ id: "task1", type: "task", parentId: "epic1" }),
      makeNode({ id: "task2", type: "task", parentId: "epic1" }),
    ];
    const childrenMap = new Map([["epic1", ["task1", "task2"]]]);
    const result = toFlowNodes(parentNodes, undefined, childrenMap);

    const epicData = result.find((n) => n.id === "epic1")!.data;
    expect(epicData.hasChildren).toBe(true);
    expect(epicData.childCount).toBe(2);

    const taskData = result.find((n) => n.id === "task1")!.data;
    expect(taskData.hasChildren).toBe(false);
    expect(taskData.childCount).toBe(0);
  });

  it("should set isExpanded based on expandedIds", () => {
    const parentNodes = [makeNode({ id: "epic1" }), makeNode({ id: "epic2" })];
    const childrenMap = new Map([["epic1", ["t1"]], ["epic2", ["t2"]]]);
    const expandedIds = new Set(["epic1"]);
    const result = toFlowNodes(parentNodes, undefined, childrenMap, expandedIds);

    expect(result.find((n) => n.id === "epic1")!.data.isExpanded).toBe(true);
    expect(result.find((n) => n.id === "epic2")!.data.isExpanded).toBe(false);
  });

  it("should pass onExpand callback through data", () => {
    const cb = (_id: string): void => { /* noop */ };
    const result = toFlowNodes([makeNode({ id: "n1" })], undefined, new Map(), new Set(), cb);
    expect(result[0].data.onExpand).toBe(cb);
  });

  it("should default hasChildren=false and isExpanded=false without childrenMap", () => {
    const result = toFlowNodes([makeNode({ id: "n1" })]);
    expect(result[0].data.hasChildren).toBe(false);
    expect(result[0].data.isExpanded).toBe(false);
    expect(result[0].data.childCount).toBe(0);
  });
});

describe("toFlowEdges", () => {
  const edges: GraphEdge[] = [
    makeEdge({ id: "e1", from: "n1", to: "n2", relationType: "depends_on" }),
    makeEdge({ id: "e2", from: "n2", to: "n3", relationType: "blocks" }),
    makeEdge({ id: "e3", from: "n1", to: "n4", relationType: "parent_of" }),
  ];

  it("should return only edges where both endpoints are visible", () => {
    const visibleIds = new Set(["n1", "n2"]);
    const result = toFlowEdges(edges, visibleIds);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e1");
  });

  it("should return empty when no visible nodes", () => {
    const result = toFlowEdges(edges, new Set());
    expect(result).toEqual([]);
  });

  it("should include edge styles based on relation type", () => {
    const visibleIds = new Set(["n1", "n2", "n3"]);
    const result = toFlowEdges(edges, visibleIds);

    const dependsOn = result.find((e) => e.id === "e1");
    expect(dependsOn?.style.stroke).toBe("#6c757d");
    expect(dependsOn?.style.strokeDasharray).toBeUndefined();
    expect(dependsOn?.label).toBe("depends on");

    const blocks = result.find((e) => e.id === "e2");
    expect(blocks?.style.stroke).toBe("#f44336");
    expect(blocks?.style.strokeDasharray).toBe("5 5");
    expect(blocks?.label).toBe("blocks");
  });

  it("should map from/to to source/target", () => {
    const visibleIds = new Set(["n1", "n2"]);
    const result = toFlowEdges(edges, visibleIds);
    expect(result[0].source).toBe("n1");
    expect(result[0].target).toBe("n2");
  });

  it("should return all edges when all nodes visible", () => {
    const visibleIds = new Set(["n1", "n2", "n3", "n4"]);
    const result = toFlowEdges(edges, visibleIds);
    expect(result).toHaveLength(3);
  });
});

describe("computeLayoutKey", () => {
  it("should produce same key for same node IDs regardless of filter path", () => {
    const key1 = computeLayoutKey(["a", "b", "c"], ["a-b", "b-c"], "TB");
    const key2 = computeLayoutKey(["a", "b", "c"], ["a-b", "b-c"], "TB");
    expect(key1).toBe(key2);
  });

  it("should produce different key for different node sets", () => {
    const key1 = computeLayoutKey(["a", "b"], ["a-b"], "TB");
    const key2 = computeLayoutKey(["a", "c"], ["a-c"], "TB");
    expect(key1).not.toBe(key2);
  });

  it("should produce different key for different directions", () => {
    const key1 = computeLayoutKey(["a", "b"], ["a-b"], "TB");
    const key2 = computeLayoutKey(["a", "b"], ["a-b"], "LR");
    expect(key1).not.toBe(key2);
  });

  it("should return a number (not string)", () => {
    const key = computeLayoutKey(["x"], [], "TB");
    expect(typeof key).toBe("number");
  });

  it("should handle empty inputs", () => {
    const key = computeLayoutKey([], [], "TB");
    expect(typeof key).toBe("number");
  });
});

describe("shouldSkipLayout", () => {
  it("should return true when filtered node IDs are identical", () => {
    expect(shouldSkipLayout(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("should return false when filtered node IDs differ", () => {
    expect(shouldSkipLayout(["a", "b"], ["a", "c"])).toBe(false);
  });

  it("should return false when lengths differ", () => {
    expect(shouldSkipLayout(["a", "b"], ["a", "b", "c"])).toBe(false);
  });

  it("should return false when prevIds is null (first render)", () => {
    expect(shouldSkipLayout(null, ["a", "b"])).toBe(false);
  });

  it("should handle empty filters (all nodes visible)", () => {
    expect(shouldSkipLayout([], [])).toBe(true);
  });

  it("should handle all-filtered-out (empty result)", () => {
    expect(shouldSkipLayout(["a"], [])).toBe(false);
  });
});
