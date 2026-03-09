import type { GraphDocument, GraphNode } from "../graph/graph-types.js";
import { findCriticalPath } from "../planner/dependency-chain.js";
import { logger } from "../utils/logger.js";

export interface BlockedTaskInfo {
  id: string;
  title: string;
  status: string;
  blockerIds: string[];
  blockerTitles: string[];
}

export interface LongChainInfo {
  path: string[];
  titles: string[];
  length: number;
}

export interface BottleneckReport {
  blockedTasks: BlockedTaskInfo[];
  criticalPath: LongChainInfo | null;
  missingAcceptanceCriteria: Array<{ id: string; title: string }>;
  oversizedTasks: Array<{ id: string; title: string; estimateMinutes: number }>;
}

const OVERSIZE_THRESHOLD_MINUTES = 120;

/**
 * Detect bottlenecks in the execution graph.
 */
export function detectBottlenecks(doc: GraphDocument): BottleneckReport {
  logger.info("Detecting bottlenecks", { nodes: doc.nodes.length, edges: doc.edges.length });

  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
  const doneIds = new Set(doc.nodes.filter((n) => n.status === "done").map((n) => n.id));

  // 1. Blocked tasks: tasks with unresolved depends_on or blocks edges
  const blockedTasks: BlockedTaskInfo[] = [];
  const taskNodes = doc.nodes.filter(
    (n) => (n.type === "task" || n.type === "subtask") && n.status !== "done",
  );

  for (const task of taskNodes) {
    const deps = doc.edges.filter(
      (e) => e.from === task.id && e.relationType === "depends_on" && !doneIds.has(e.to),
    );
    // Also check blocks edges: edge.to === task.id means someone blocks this task
    const blocksEdges = doc.edges.filter(
      (e) => e.to === task.id && e.relationType === "blocks" && !doneIds.has(e.from),
    );
    const allBlockerIds = [
      ...deps.map((e) => e.to),
      ...blocksEdges.map((e) => e.from),
    ];
    if (allBlockerIds.length > 0 || task.blocked) {
      blockedTasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        blockerIds: allBlockerIds,
        blockerTitles: allBlockerIds.map((id) => nodeMap.get(id)?.title ?? id),
      });
    }
  }

  // 2. Critical path (longest dependency chain)
  let criticalPath: LongChainInfo | null = null;
  try {
    const cpNodes = findCriticalPath(doc);
    if (cpNodes.length > 1) {
      criticalPath = {
        path: cpNodes.map((n) => n.id),
        titles: cpNodes.map((n) => n.title),
        length: cpNodes.length,
      };
    }
  } catch {
    // Graph may have cycles or be empty
  }

  // 3. Tasks/epics without acceptance criteria
  const missingAcceptanceCriteria = doc.nodes
    .filter(
      (n) =>
        (n.type === "task" || n.type === "epic") &&
        n.status !== "done" &&
        (!n.acceptanceCriteria || n.acceptanceCriteria.length === 0),
    )
    .map((n) => ({ id: n.id, title: n.title }));

  // 4. Oversized tasks (estimate > threshold without decomposition)
  // A node has children if: (a) some node has parentId pointing to it, or
  // (b) it has outgoing parent_of edges, or (c) it has incoming child_of edges
  const parentViaParentId = new Set(doc.nodes.filter((n) => n.parentId).map((n) => n.parentId));
  const parentViaEdges = new Set<string>();
  for (const edge of doc.edges) {
    if (edge.relationType === "parent_of") parentViaEdges.add(edge.from);
    if (edge.relationType === "child_of") parentViaEdges.add(edge.to);
  }
  const hasChildren = (id: string): boolean =>
    parentViaParentId.has(id) || parentViaEdges.has(id);

  const oversizedTasks = doc.nodes
    .filter(
      (n) =>
        (n.type === "task" || n.type === "subtask") &&
        n.status !== "done" &&
        n.estimateMinutes != null &&
        n.estimateMinutes > OVERSIZE_THRESHOLD_MINUTES &&
        !hasChildren(n.id),
    )
    .map((n) => ({ id: n.id, title: n.title, estimateMinutes: n.estimateMinutes! }));

  logger.info("Bottleneck detection complete", {
    blocked: blockedTasks.length,
    missingAC: missingAcceptanceCriteria.length,
    oversized: oversizedTasks.length,
  });

  return {
    blockedTasks,
    criticalPath,
    missingAcceptanceCriteria,
    oversizedTasks,
  };
}
