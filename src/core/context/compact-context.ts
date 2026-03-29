import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode, GraphEdge } from "../graph/graph-types.js";
import type { GraphSnapshot } from "../store/graph-snapshot-cache.js";
import { getNodeAcFromStore } from "../utils/ac-helpers.js";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";

// ── Constants ────────────────────────────────────────────

export const NEIGHBOR_DESC_LIMIT = 100;

// ── Types ────────────────────────────────────────────────

export interface TaskContext {
  task: TaskSummary;
  /** Bug #035: semantic alias — always mirrors 'task', present for all node types */
  node: TaskSummary;
  parent: TaskSummary | null;
  children: TaskSummary[];
  blockers: BlockerInfo[];
  dependsOn: DependencyInfo[];
  relatedNodes?: TaskSummary[];
  implementsNodes?: TaskSummary[];
  derivedFromNodes?: TaskSummary[];
  edgeParent?: TaskSummary | null;
  edgeChildren?: TaskSummary[];
  acceptanceCriteria: string[];
  sourceRef: SourceRefInfo | null;
  metrics: ContextMetrics;
}

export interface TaskSummary {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: number;
  description?: string;
  sprint?: string | null;
  xpSize?: string;
  tags?: string[];
}

interface BlockerInfo {
  id: string;
  title: string;
  status: string;
  relationType: string;
  inferred: boolean;
}

interface DependencyInfo {
  id: string;
  title: string;
  status: string;
  resolved: boolean;
  inferred: boolean;
}

interface SourceRefInfo {
  file: string;
  startLine?: number;
  endLine?: number;
  confidence?: number;
}

export interface ContextMetrics {
  originalChars: number;
  compactChars: number;
  reductionPercent: number;
  estimatedTokens: number;
}

export interface NaiveNeighborhood {
  task: GraphNode;
  parent: GraphNode | null;
  children: GraphNode[];
  blockers: GraphNode[];
  dependsOn: GraphNode[];
  estimatedTokens: number;
}

export interface LayeredTokenMetrics {
  naiveNodeTokens: number;
  naiveNeighborhoodTokens: number;
  compactContextTokens: number;
  neighborTruncatedTokens: number;
  shortKeysTokens: number;
  defaultOmittedTokens: number;
  summaryTierTokens: number;
  layer1Savings: number;
  layer2Savings: number;
  layer3Savings: number;
  layer4Savings: number;
  totalRealSavings: number;
  totalRealSavingsPercent: number;
}

export interface CompressedContext {
  payload: Record<string, unknown>;
  layerMetrics: {
    l1Tokens: number;
    l2Tokens: number;
    l3Tokens: number;
    l4Tokens: number;
    totalReductionPercent: number;
  };
}

// ── Key Map for structural compression ──────────────────

const KEY_MAP: Record<string, string> = {
  // TaskContext top-level
  task: "tk", node: "n", parent: "par", children: "ch",
  blockers: "bl", dependsOn: "dep",
  acceptanceCriteria: "ac", sourceRef: "sr",
  relatedNodes: "rel", implementsNodes: "impl",
  derivedFromNodes: "drv", edgeParent: "ep", edgeChildren: "ech",
  metrics: "m",
  // TaskSummary / shared fields
  id: "i", type: "t", title: "n", status: "s",
  priority: "p", description: "d", sprint: "sp",
  xpSize: "xs", tags: "tg",
  // BlockerInfo / DependencyInfo
  relationType: "rt", inferred: "inf", resolved: "res",
  // SourceRefInfo
  file: "f", startLine: "sl", endLine: "el", confidence: "cf",
  // ContextMetrics
  originalChars: "oc", compactChars: "cc",
  reductionPercent: "rp", estimatedTokens: "et",
};

const KEY_LEGEND: Record<string, string> = {};
for (const [full, short] of Object.entries(KEY_MAP)) {
  KEY_LEGEND[short] = full;
}

// ── Helpers ──────────────────────────────────────────────

function toTaskSummary(node: GraphNode): TaskSummary {
  const summary: TaskSummary = {
    id: node.id,
    type: node.type,
    title: node.title,
    status: node.status,
    priority: node.priority,
  };
  if (node.description) summary.description = node.description;
  if (node.sprint) summary.sprint = node.sprint;
  if (node.xpSize) summary.xpSize = node.xpSize;
  if (node.tags?.length) summary.tags = node.tags;
  return summary;
}

function isInferred(edge: GraphEdge): boolean {
  return edge.metadata?.inferred === true;
}

/**
 * Truncate a description to a character limit, preferring sentence boundaries.
 */
export function truncateDescription(desc: string | undefined, limit: number): string | undefined {
  if (desc === undefined || desc.length <= limit) return desc;
  const sentenceEnd = desc.lastIndexOf(".", limit);
  if (sentenceEnd > limit * 0.5) return desc.slice(0, sentenceEnd + 1);
  return desc.slice(0, limit) + "…";
}

/**
 * Recursively rename object keys using KEY_MAP.
 */
export function compressKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(compressKeys);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = KEY_MAP[key] ?? key;
      result[newKey] = (typeof value === "object" && value !== null) ? compressKeys(value) : value;
    }
    return result;
  }
  return obj;
}

/**
 * Recursively omit fields with default values.
 * Defaults: priority=3, status="backlog", inferred=false, resolved=false
 */
export function omitDefaults(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(omitDefaults);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "priority" && value === 3) continue;
      if (key === "status" && value === "backlog") continue;
      if (key === "inferred" && value === false) continue;
      if (key === "resolved" && value === false) continue;
      result[key] = (typeof value === "object" && value !== null) ? omitDefaults(value) : value;
    }
    return result;
  }
  return obj;
}

// ── Main function ────────────────────────────────────────

export function buildTaskContext(
  store: SqliteStore,
  nodeId: string,
  snapshot?: GraphSnapshot,
): TaskContext | null {
  // Helper: resolve node by ID using snapshot (O(1)) or store query
  const resolveNode = (id: string): GraphNode | null => {
    if (snapshot) {
      return snapshot.nodes.find((n) => n.id === id) ?? null;
    }
    return store.getNodeById(id);
  };

  const node = resolveNode(nodeId);
  if (!node) {
    logger.warn(`buildTaskContext: node ${nodeId} not found`);
    return null;
  }

  // Parent
  let parent: TaskSummary | null = null;
  if (node.parentId) {
    const parentNode = resolveNode(node.parentId);
    if (parentNode) parent = toTaskSummary(parentNode);
  }

  // Children — from snapshot or store
  const childNodes = snapshot
    ? snapshot.nodes.filter((n) => n.parentId === nodeId)
    : store.getChildNodes(nodeId);
  const children = childNodes.map(toTaskSummary);

  // Incoming/outgoing edges — from snapshot or store
  const incomingEdges = snapshot
    ? snapshot.edges.filter((e) => e.to === nodeId)
    : store.getEdgesTo(nodeId);
  const outgoingEdges = snapshot
    ? snapshot.edges.filter((e) => e.from === nodeId)
    : store.getEdgesFrom(nodeId);

  const blockers: BlockerInfo[] = [];
  const dependsOn: DependencyInfo[] = [];
  const relatedIds = new Set<string>();
  const relatedNodes: TaskSummary[] = [];
  const implementsNodes: TaskSummary[] = [];
  const derivedFromNodes: TaskSummary[] = [];
  let edgeParent: TaskSummary | null = null;
  const edgeChildren: TaskSummary[] = [];
  const edgeChildrenIds = new Set<string>();

  // Edges where something blocks this node: edge.relationType === "blocks" AND edge.to === nodeId
  for (const edge of incomingEdges) {
    if (edge.relationType === "blocks") {
      const blockerNode = resolveNode(edge.from);
      if (blockerNode) {
        blockers.push({
          id: blockerNode.id,
          title: blockerNode.title,
          status: blockerNode.status,
          relationType: edge.relationType,
          inferred: isInferred(edge),
        });
      }
    } else if (edge.relationType === "related_to") {
      const relNode = resolveNode(edge.from);
      if (relNode && !relatedIds.has(relNode.id)) {
        relatedIds.add(relNode.id);
        relatedNodes.push(toTaskSummary(relNode));
      }
    } else if (edge.relationType === "parent_of" && !edgeParent) {
      const parentNode = resolveNode(edge.from);
      if (parentNode) edgeParent = toTaskSummary(parentNode);
    }
  }

  // Edges where this node depends_on something: edge.relationType === "depends_on" AND edge.from === nodeId
  for (const edge of outgoingEdges) {
    if (edge.relationType === "depends_on") {
      const depNode = resolveNode(edge.to);
      if (depNode) {
        dependsOn.push({
          id: depNode.id,
          title: depNode.title,
          status: depNode.status,
          resolved: depNode.status === "done",
          inferred: isInferred(edge),
        });
      }
    } else if (edge.relationType === "related_to") {
      const relNode = resolveNode(edge.to);
      if (relNode && !relatedIds.has(relNode.id)) {
        relatedIds.add(relNode.id);
        relatedNodes.push(toTaskSummary(relNode));
      }
    } else if (edge.relationType === "implements") {
      const implNode = resolveNode(edge.to);
      if (implNode) implementsNodes.push(toTaskSummary(implNode));
    } else if (edge.relationType === "derived_from") {
      const derivedNode = resolveNode(edge.to);
      if (derivedNode) derivedFromNodes.push(toTaskSummary(derivedNode));
    } else if (edge.relationType === "parent_of") {
      const childNode = resolveNode(edge.to);
      if (childNode && !edgeChildrenIds.has(childNode.id)) {
        edgeChildrenIds.add(childNode.id);
        edgeChildren.push(toTaskSummary(childNode));
      }
    }
  }

  // Acceptance criteria (inline + child AC nodes) — targeted queries, no full graph scan
  const acceptanceCriteria = getNodeAcFromStore(store, node.id);

  // Source reference
  const sourceRef: SourceRefInfo | null = node.sourceRef
    ? { ...node.sourceRef }
    : null;

  // Metrics: estimate original size from local data already loaded (node + children + deps)
  const localNodes = [node, ...childNodes];
  const originalChars =
    localNodes.reduce(
      (sum, n) =>
        sum +
        n.title.length +
        (n.description?.length ?? 0) +
        (n.acceptanceCriteria?.join("").length ?? 0),
      0,
    ) +
    [...incomingEdges, ...outgoingEdges].reduce((sum, e) => sum + (e.reason?.length ?? 0), 0);

  const summary = toTaskSummary(node);
  // Build payload without 'node' alias for accurate metrics calculation
  const corePayload = {
    task: summary,
    parent,
    children,
    blockers,
    dependsOn,
    relatedNodes: relatedNodes.length > 0 ? relatedNodes : undefined,
    implementsNodes: implementsNodes.length > 0 ? implementsNodes : undefined,
    derivedFromNodes: derivedFromNodes.length > 0 ? derivedFromNodes : undefined,
    edgeParent: edgeParent ?? undefined,
    edgeChildren: edgeChildren.length > 0 ? edgeChildren : undefined,
    acceptanceCriteria,
    sourceRef,
    metrics: { originalChars: 0, compactChars: 0, reductionPercent: 0, estimatedTokens: 0 },
  };

  const compactJson = JSON.stringify(corePayload);
  const compactChars = compactJson.length;
  // Bug #034: negative values indicate expansion (JSON overhead > raw text).
  // This is expected for small nodes where structure metadata exceeds original content.
  const reductionPercent =
    originalChars > 0
      ? Math.round(((originalChars - compactChars) / originalChars) * 100)
      : 0;

  const metrics = {
    originalChars,
    compactChars,
    reductionPercent,
    estimatedTokens: estimateTokens(compactJson),
  };

  // Bug #035: assemble final payload with 'node' alias (same reference as 'task')
  const contextPayload: TaskContext = {
    ...corePayload,
    node: summary,
    metrics,
  };

  logger.info(`Context for ${nodeId}: ${metrics.estimatedTokens} tokens, ${metrics.reductionPercent}% reduction`);

  return contextPayload;
}

// ── Naive Neighborhood (honest baseline) ─────────────────

export function buildNaiveNeighborhood(
  store: SqliteStore,
  nodeId: string,
): NaiveNeighborhood | null {
  const node = store.getNodeById(nodeId);
  if (!node) return null;

  // Parent
  let parent: GraphNode | null = null;
  if (node.parentId) {
    const parentNode = store.getNodeById(node.parentId);
    if (parentNode) parent = parentNode;
  }

  // Children
  const children = store.getChildNodes(nodeId);

  // Edges — same logic as buildTaskContext but returning full GraphNode
  const incomingEdges = store.getEdgesTo(nodeId);
  const outgoingEdges = store.getEdgesFrom(nodeId);

  const blockers: GraphNode[] = [];
  const dependsOn: GraphNode[] = [];
  const relatedIds = new Set<string>();
  const relatedNodes: GraphNode[] = [];
  const implementsNodes: GraphNode[] = [];
  const derivedFromNodes: GraphNode[] = [];
  let edgeParent: GraphNode | null = null;
  const edgeChildren: GraphNode[] = [];
  const edgeChildrenIds = new Set<string>();

  for (const edge of incomingEdges) {
    if (edge.relationType === "blocks") {
      const blockerNode = store.getNodeById(edge.from);
      if (blockerNode) blockers.push(blockerNode);
    } else if (edge.relationType === "related_to") {
      const relNode = store.getNodeById(edge.from);
      if (relNode && !relatedIds.has(relNode.id)) {
        relatedIds.add(relNode.id);
        relatedNodes.push(relNode);
      }
    } else if (edge.relationType === "parent_of" && !edgeParent) {
      const pNode = store.getNodeById(edge.from);
      if (pNode) edgeParent = pNode;
    }
  }

  for (const edge of outgoingEdges) {
    if (edge.relationType === "depends_on") {
      const depNode = store.getNodeById(edge.to);
      if (depNode) dependsOn.push(depNode);
    } else if (edge.relationType === "related_to") {
      const relNode = store.getNodeById(edge.to);
      if (relNode && !relatedIds.has(relNode.id)) {
        relatedIds.add(relNode.id);
        relatedNodes.push(relNode);
      }
    } else if (edge.relationType === "implements") {
      const implNode = store.getNodeById(edge.to);
      if (implNode) implementsNodes.push(implNode);
    } else if (edge.relationType === "derived_from") {
      const derivedNode = store.getNodeById(edge.to);
      if (derivedNode) derivedFromNodes.push(derivedNode);
    } else if (edge.relationType === "parent_of") {
      const cNode = store.getNodeById(edge.to);
      if (cNode && !edgeChildrenIds.has(cNode.id)) {
        edgeChildrenIds.add(cNode.id);
        edgeChildren.push(cNode);
      }
    }
  }

  const payload: Record<string, unknown> = {
    task: node,
    parent,
    children,
    blockers,
    dependsOn,
    acceptanceCriteria: node.acceptanceCriteria ?? [],
    sourceRef: node.sourceRef ?? null,
  };
  if (relatedNodes.length > 0) payload["relatedNodes"] = relatedNodes;
  if (implementsNodes.length > 0) payload["implementsNodes"] = implementsNodes;
  if (derivedFromNodes.length > 0) payload["derivedFromNodes"] = derivedFromNodes;
  if (edgeParent) payload["edgeParent"] = edgeParent;
  if (edgeChildren.length > 0) payload["edgeChildren"] = edgeChildren;

  const estimatedTokensValue = estimateTokens(JSON.stringify(payload));

  return {
    task: node,
    parent,
    children,
    blockers,
    dependsOn,
    estimatedTokens: estimatedTokensValue,
  };
}

// ── Compressed Context (L2 + L3 + L4) ───────────────────

export function buildCompressedContext(
  store: SqliteStore,
  nodeId: string,
): CompressedContext | null {
  const compact = buildTaskContext(store, nodeId);
  if (!compact) return null;

  const l1Tokens = compact.metrics.estimatedTokens;

  // L2 — Neighbor Description Truncation
  // Task description: keep full. Neighbors: truncate. Children: remove description.
  const l2Payload = structuredClone(compact) as TaskContext;
  if (l2Payload.parent?.description) {
    l2Payload.parent.description = truncateDescription(l2Payload.parent.description, NEIGHBOR_DESC_LIMIT);
  }
  for (const child of l2Payload.children) {
    delete child.description;
  }
  if (l2Payload.relatedNodes) {
    for (const rel of l2Payload.relatedNodes) {
      rel.description = truncateDescription(rel.description, NEIGHBOR_DESC_LIMIT);
    }
  }
  if (l2Payload.edgeChildren) {
    for (const ec of l2Payload.edgeChildren) {
      delete ec.description;
    }
  }
  // Remove metrics from serialization (internal field)
  const { metrics: _m, ...l2WithoutMetrics } = l2Payload;
  const l2Tokens = estimateTokens(JSON.stringify(l2WithoutMetrics));

  // L3 — Default Omission (before key compression so keys are still original names)
  const l3Payload = omitDefaults(l2WithoutMetrics) as Record<string, unknown>;
  const l3Tokens = estimateTokens(JSON.stringify(l3Payload));

  // L4 — Short Keys (final structural compression)
  const l4Payload = compressKeys(l3Payload) as Record<string, unknown>;
  l4Payload["_k"] = "see formulas.keyLegend";
  const l4Tokens = estimateTokens(JSON.stringify(l4Payload));

  const totalReductionPercent = l1Tokens > 0
    ? Math.round(((l1Tokens - l4Tokens) / l1Tokens) * 100)
    : 0;

  return {
    payload: l4Payload,
    layerMetrics: {
      l1Tokens,
      l2Tokens,
      l3Tokens,
      l4Tokens,
      totalReductionPercent,
    },
  };
}

// ── Layered Metrics ──────────────────────────────────────

export function computeLayeredMetrics(
  store: SqliteStore,
  nodeId: string,
): LayeredTokenMetrics | null {
  const node = store.getNodeById(nodeId);
  if (!node) return null;

  const naiveNodeTokens = estimateTokens(JSON.stringify(node));

  const naive = buildNaiveNeighborhood(store, nodeId);
  if (!naive) return null;
  const naiveNeighborhoodTokens = naive.estimatedTokens;

  const compressed = buildCompressedContext(store, nodeId);
  if (!compressed) return null;

  const compactContextTokens = compressed.layerMetrics.l1Tokens;
  const neighborTruncatedTokens = compressed.layerMetrics.l2Tokens;
  const defaultOmittedTokens = compressed.layerMetrics.l3Tokens;
  const shortKeysTokens = compressed.layerMetrics.l4Tokens;

  const summaryPayload = {
    id: node.id,
    type: node.type,
    title: node.title,
    status: node.status,
    priority: node.priority,
  };
  const summaryTierTokens = estimateTokens(JSON.stringify(summaryPayload));

  const layer1Savings = naiveNeighborhoodTokens - compactContextTokens;
  const layer2Savings = compactContextTokens - neighborTruncatedTokens;
  const layer3Savings = neighborTruncatedTokens - defaultOmittedTokens;
  const layer4Savings = defaultOmittedTokens - shortKeysTokens;
  const totalRealSavings = naiveNeighborhoodTokens - summaryTierTokens;
  const totalRealSavingsPercent = naiveNeighborhoodTokens > 0
    ? Math.round((totalRealSavings / naiveNeighborhoodTokens) * 100)
    : 0;

  return {
    naiveNodeTokens,
    naiveNeighborhoodTokens,
    compactContextTokens,
    neighborTruncatedTokens,
    shortKeysTokens,
    defaultOmittedTokens,
    summaryTierTokens,
    layer1Savings,
    layer2Savings,
    layer3Savings,
    layer4Savings,
    totalRealSavings,
    totalRealSavingsPercent,
  };
}
