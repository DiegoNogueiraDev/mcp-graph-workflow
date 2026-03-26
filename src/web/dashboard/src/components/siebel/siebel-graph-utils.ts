/**
 * Siebel Graph Utils — Converts SiebelObjects + Dependencies to React Flow nodes/edges.
 * Follows the pattern of graph-utils.ts for the workflow graph.
 */

import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import { SIEBEL_TYPE_COLORS, SIEBEL_RELATION_STYLES } from "@/lib/constants";

// ── Types ──

export interface SiebelObjectData {
  name: string;
  type: string;
  project?: string;
  properties: Array<{ name: string; value: string }>;
  children: Array<{ name: string; type: string; properties: Array<{ name: string; value: string }>; children: unknown[]; parentName?: string }>;
  inactive?: boolean;
}

export interface SiebelDependencyData {
  from: { name: string; type: string };
  to: { name: string; type: string };
  relationType: string;
  inferred?: boolean;
}

export interface SiebelNodeData {
  label: string;
  siebelType: string;
  project?: string;
  propertyCount: number;
  childCount: number;
  inactive?: boolean;
  sourceObject: SiebelObjectData;
  isImpacted?: boolean;
  impactLevel?: "direct" | "transitive";
  [key: string]: unknown;
}

export interface SiebelEdgeData {
  relationType: string;
  inferred?: boolean;
  [key: string]: unknown;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

// ── Node ID generation ──

function makeNodeId(type: string, name: string): string {
  return `siebel:${type}:${name}`;
}

// ── Conversion ──

export function toSiebelFlowNodes(
  objects: SiebelObjectData[],
  filters?: { types?: Set<string>; showInactive?: boolean },
  impactedObjects?: Map<string, "direct" | "transitive">,
): Node<SiebelNodeData>[] {
  return objects
    .filter((obj) => {
      if (filters?.types?.size && !filters.types.has(obj.type)) return false;
      if (!filters?.showInactive && obj.inactive) return false;
      return true;
    })
    .map((obj) => {
      const id = makeNodeId(obj.type, obj.name);
      const color = SIEBEL_TYPE_COLORS[obj.type] || "#6b7280";
      const impactLevel = impactedObjects?.get(id);

      return {
        id,
        type: "siebelNode",
        position: { x: 0, y: 0 },
        data: {
          label: obj.name,
          siebelType: obj.type,
          project: obj.project,
          propertyCount: obj.properties.length,
          childCount: obj.children.length,
          inactive: obj.inactive,
          sourceObject: obj,
          isImpacted: !!impactLevel,
          impactLevel,
        },
        style: {
          width: NODE_WIDTH,
          borderLeft: `4px solid ${color}`,
        },
      };
    });
}

export function toSiebelFlowEdges(
  dependencies: SiebelDependencyData[],
  visibleNodeIds: Set<string>,
): Edge<SiebelEdgeData>[] {
  return dependencies
    .map((dep, i) => {
      const sourceId = makeNodeId(dep.from.type, dep.from.name);
      const targetId = makeNodeId(dep.to.type, dep.to.name);

      if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) return null;

      const style = SIEBEL_RELATION_STYLES[dep.relationType] || SIEBEL_RELATION_STYLES.references;

      return {
        id: `siebel-edge-${i}`,
        source: sourceId,
        target: targetId,
        label: style.label,
        type: "siebelEdge",
        data: { relationType: dep.relationType, inferred: dep.inferred },
        style: {
          stroke: style.color,
          strokeDasharray: style.dashed ? "5 5" : undefined,
        },
        labelStyle: { fontSize: 10, fill: "#6c757d" },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}

// ── Layout ──

let layoutCache: {
  key: number;
  positions: Map<string, { x: number; y: number }>;
} | null = null;

function computeKey(nodeIds: string[], edgePairs: string[], direction: string): number {
  let hash = 0;
  const parts = [direction, ...nodeIds, "|", ...edgePairs];
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash = ((hash << 5) - hash + part.charCodeAt(i)) | 0;
    }
  }
  return hash;
}

export function applySiebelDagreLayout(
  nodes: Node<SiebelNodeData>[],
  edges: Edge<SiebelEdgeData>[],
  direction: "TB" | "LR" = "TB",
): { nodes: Node<SiebelNodeData>[]; edges: Edge<SiebelEdgeData>[] } {
  const nodeIds = nodes.map((n) => n.id);
  const edgePairs = edges.map((e) => `${e.source}-${e.target}`);
  const cacheKey = computeKey(nodeIds, edgePairs, direction);

  let positions: Map<string, { x: number; y: number }>;

  if (layoutCache && layoutCache.key === cacheKey) {
    positions = layoutCache.positions;
  } else {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 50 });

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

// ── Impact Analysis (client-side BFS) ──

export function computeImpact(
  dependencies: SiebelDependencyData[],
  targetType: string,
  targetName: string,
): Map<string, "direct" | "transitive"> {
  const targetId = makeNodeId(targetType, targetName);
  const impacted = new Map<string, "direct" | "transitive">();

  // Build adjacency (reverse: who depends on target)
  const dependents = new Map<string, string[]>();
  for (const dep of dependencies) {
    const toId = makeNodeId(dep.to.type, dep.to.name);
    const fromId = makeNodeId(dep.from.type, dep.from.name);
    if (!dependents.has(toId)) dependents.set(toId, []);
    dependents.get(toId)!.push(fromId);
  }

  // BFS from target
  const queue = [targetId];
  const visited = new Set([targetId]);
  let depth = 0;

  while (queue.length > 0) {
    const levelSize = queue.length;
    depth++;

    for (let i = 0; i < levelSize; i++) {
      const current = queue.shift()!;
      const deps = dependents.get(current) || [];

      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          impacted.set(dep, depth === 1 ? "direct" : "transitive");
          queue.push(dep);
        }
      }
    }
  }

  return impacted;
}

export { makeNodeId };
