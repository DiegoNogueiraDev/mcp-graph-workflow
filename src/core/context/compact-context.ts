import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode, GraphEdge } from "../graph/graph-types.js";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";

// ── Types ────────────────────────────────────────────────

export interface TaskContext {
  task: TaskSummary;
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

// ── Main function ────────────────────────────────────────

export function buildTaskContext(
  store: SqliteStore,
  nodeId: string,
): TaskContext | null {
  const node = store.getNodeById(nodeId);
  if (!node) {
    logger.warn(`buildTaskContext: node ${nodeId} not found`);
    return null;
  }

  // Parent
  let parent: TaskSummary | null = null;
  if (node.parentId) {
    const parentNode = store.getNodeById(node.parentId);
    if (parentNode) parent = toTaskSummary(parentNode);
  }

  // Children
  const childNodes = store.getChildNodes(nodeId);
  const children = childNodes.map(toTaskSummary);

  // Incoming edges → blockers and dependencies
  const incomingEdges = store.getEdgesTo(nodeId);
  const outgoingEdges = store.getEdgesFrom(nodeId);

  const blockers: BlockerInfo[] = [];
  const dependsOn: DependencyInfo[] = [];
  const relatedIds = new Set<string>();
  const relatedNodes: TaskSummary[] = [];
  const implementsNodes: TaskSummary[] = [];
  const derivedFromNodes: TaskSummary[] = [];
  let edgeParent: TaskSummary | null = null;
  const edgeChildren: TaskSummary[] = [];

  // Edges where something blocks this node: edge.relationType === "blocks" AND edge.to === nodeId
  for (const edge of incomingEdges) {
    if (edge.relationType === "blocks") {
      const blockerNode = store.getNodeById(edge.from);
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
      const relNode = store.getNodeById(edge.from);
      if (relNode && !relatedIds.has(relNode.id)) {
        relatedIds.add(relNode.id);
        relatedNodes.push(toTaskSummary(relNode));
      }
    } else if (edge.relationType === "parent_of" && !edgeParent) {
      const parentNode = store.getNodeById(edge.from);
      if (parentNode) edgeParent = toTaskSummary(parentNode);
    } else if (edge.relationType === "child_of") {
      const childNode = store.getNodeById(edge.from);
      if (childNode) edgeChildren.push(toTaskSummary(childNode));
    }
  }

  // Edges where this node depends_on something: edge.relationType === "depends_on" AND edge.from === nodeId
  for (const edge of outgoingEdges) {
    if (edge.relationType === "depends_on") {
      const depNode = store.getNodeById(edge.to);
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
      const relNode = store.getNodeById(edge.to);
      if (relNode && !relatedIds.has(relNode.id)) {
        relatedIds.add(relNode.id);
        relatedNodes.push(toTaskSummary(relNode));
      }
    } else if (edge.relationType === "implements") {
      const implNode = store.getNodeById(edge.to);
      if (implNode) implementsNodes.push(toTaskSummary(implNode));
    } else if (edge.relationType === "derived_from") {
      const derivedNode = store.getNodeById(edge.to);
      if (derivedNode) derivedFromNodes.push(toTaskSummary(derivedNode));
    } else if (edge.relationType === "child_of" && !edgeParent) {
      const parentNode = store.getNodeById(edge.to);
      if (parentNode) edgeParent = toTaskSummary(parentNode);
    } else if (edge.relationType === "parent_of") {
      const childNode = store.getNodeById(edge.to);
      if (childNode) edgeChildren.push(toTaskSummary(childNode));
    }
  }

  // Acceptance criteria
  const acceptanceCriteria = node.acceptanceCriteria ?? [];

  // Source reference
  const sourceRef: SourceRefInfo | null = node.sourceRef
    ? { ...node.sourceRef }
    : null;

  // Metrics: estimate original size from full PRD-related content
  const allNodes = store.getAllNodes();
  const allEdges = store.getAllEdges();
  const originalChars =
    allNodes.reduce(
      (sum, n) =>
        sum +
        n.title.length +
        (n.description?.length ?? 0) +
        (n.acceptanceCriteria?.join("").length ?? 0),
      0,
    ) +
    allEdges.reduce((sum, e) => sum + (e.reason?.length ?? 0), 0);

  const contextPayload: TaskContext = {
    task: toTaskSummary(node),
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

  const compactJson = JSON.stringify(contextPayload);
  const compactChars = compactJson.length;
  const reductionPercent =
    originalChars > 0
      ? Math.round(((originalChars - compactChars) / originalChars) * 100)
      : 0;

  contextPayload.metrics = {
    originalChars,
    compactChars,
    reductionPercent: Math.max(0, reductionPercent),
    estimatedTokens: estimateTokens(compactJson),
  };

  logger.info(`Context for ${nodeId}: ${contextPayload.metrics.estimatedTokens} tokens, ${contextPayload.metrics.reductionPercent}% reduction`);

  return contextPayload;
}
