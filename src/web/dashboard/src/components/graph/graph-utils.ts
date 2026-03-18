import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { GraphNode, GraphEdge, NodeStatus, NodeType } from "@/lib/types";
import { NODE_TYPE_COLORS, STATUS_COLORS, EDGE_STYLES } from "@/lib/constants";

export interface WorkflowNodeData {
  label: string;
  nodeType: NodeType;
  status: NodeStatus;
  priority: number;
  xpSize?: string;
  sprint?: string | null;
  sourceNode: GraphNode;
  hasChildren: boolean;
  isExpanded: boolean;
  childCount: number;
  onExpand?: (nodeId: string) => void;
  [key: string]: unknown;
}

export interface WorkflowEdgeData {
  relationType: string;
  [key: string]: unknown;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 80;

export function toFlowNodes(
  nodes: GraphNode[],
  filters?: { statuses?: Set<string>; types?: Set<string> },
  childrenMap?: Map<string, string[]>,
  expandedIds?: Set<string>,
  onExpand?: (nodeId: string) => void,
): Node<WorkflowNodeData>[] {
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

export function toFlowEdges(
  edges: GraphEdge[],
  visibleNodeIds: Set<string>,
): Edge<WorkflowEdgeData>[] {
  return edges
    .filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to))
    .map((e) => {
      const style = EDGE_STYLES[e.relationType] || EDGE_STYLES.related_to;
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        label: style.label,
        type: "workflowEdge",
        data: { relationType: e.relationType },
        style: {
          stroke: style.color,
          strokeDasharray: style.dashed ? "5 5" : undefined,
        },
        labelStyle: { fontSize: 10, fill: "#6c757d" },
      };
    });
}

/**
 * Deterministic numeric hash for layout cache key.
 * Avoids O(n) string concatenation — uses incremental char-code hashing.
 */
export function computeLayoutKey(nodeIds: string[], edgePairs: string[], direction: string): number {
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
 * Returns true if layout recalculation can be skipped (same visible node IDs).
 */
export function shouldSkipLayout(prevIds: string[] | null, nextIds: string[]): boolean {
  if (prevIds === null) return false;
  if (prevIds.length !== nextIds.length) return false;
  for (let i = 0; i < prevIds.length; i++) {
    if (prevIds[i] !== nextIds[i]) return false;
  }
  return true;
}

// Layout cache stores only computed positions (not node objects with callbacks)
// so multiple tabs sharing the same node IDs get correct layout without stale closures.
let layoutCache: {
  key: number;
  positions: Map<string, { x: number; y: number }>;
} | null = null;

export function applyDagreLayout(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge<WorkflowEdgeData>[],
  direction: "TB" | "LR" = "TB",
): { nodes: Node<WorkflowNodeData>[]; edges: Edge<WorkflowEdgeData>[] } {
  const nodeIds = nodes.map((n) => n.id);
  const edgePairs = edges.map((e) => `${e.source}-${e.target}`);
  const cacheKey = computeLayoutKey(nodeIds, edgePairs, direction);

  let positions: Map<string, { x: number; y: number }>;

  if (layoutCache && layoutCache.key === cacheKey) {
    positions = layoutCache.positions;
  } else {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, ranksep: 60, nodesep: 40 });

    for (const node of nodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    positions = new Map();
    for (const node of nodes) {
      const pos = g.node(node.id);
      positions.set(node.id, {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      });
    }

    layoutCache = { key: cacheKey, positions };
  }

  const layoutedNodes = nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 };
    return { ...node, position: pos };
  });

  return { nodes: layoutedNodes, edges };
}

export { NODE_TYPE_COLORS, STATUS_COLORS };
