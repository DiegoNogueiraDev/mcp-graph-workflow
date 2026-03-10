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
): Node<WorkflowNodeData>[] {
  return nodes
    .filter((n) => {
      if (filters?.statuses?.size && !filters.statuses.has(n.status)) return false;
      if (filters?.types?.size && !filters.types.has(n.type)) return false;
      return true;
    })
    .map((n) => ({
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
      },
      style: {
        width: NODE_WIDTH,
        borderLeft: `4px solid ${NODE_TYPE_COLORS[n.type] || "#6c757d"}`,
      },
    }));
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

// Layout cache to avoid expensive Dagre recalculation on tab switches
let layoutCache: {
  key: string;
  result: { nodes: Node<WorkflowNodeData>[]; edges: Edge<WorkflowEdgeData>[] };
} | null = null;

export function applyDagreLayout(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge<WorkflowEdgeData>[],
  direction: "TB" | "LR" = "TB",
): { nodes: Node<WorkflowNodeData>[]; edges: Edge<WorkflowEdgeData>[] } {
  // Cache key: direction + node IDs + edge source/target pairs
  const cacheKey = `${direction}:${nodes.map((n) => n.id).join(",")}:${edges.map((e) => `${e.source}-${e.target}`).join(",")}`;
  if (layoutCache && layoutCache.key === cacheKey) {
    return layoutCache.result;
  }

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

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  const result = { nodes: layoutedNodes, edges };
  layoutCache = { key: cacheKey, result };
  return result;
}

export { NODE_TYPE_COLORS, STATUS_COLORS };
