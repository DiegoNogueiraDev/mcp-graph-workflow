/**
 * Execution planner: suggests the next best task to work on.
 *
 * Algorithm:
 * 1. Filter nodes of type task/subtask with status backlog or ready
 * 2. Eliminate nodes with unresolved depends_on edges (dependency target not done)
 * 3. Eliminate nodes with blocked = true
 * 4. Sort by: priority ASC, xpSize ASC, estimateMinutes ASC, createdAt ASC
 */

import type { GraphDocument, GraphNode, GraphEdge } from "../graph/graph-types.js";
import { XP_SIZE_ORDER } from "../utils/xp-sizing.js";
import { logger } from "../utils/logger.js";

export interface NextTaskResult {
  node: GraphNode;
  reason: string;
}

export function findNextTask(doc: GraphDocument): NextTaskResult | null {
  // Step 1: Filter eligible nodes
  const eligible = doc.nodes.filter(
    (n) =>
      (n.type === "task" || n.type === "subtask") &&
      (n.status === "backlog" || n.status === "ready") &&
      !n.blocked,
  );

  logger.debug("Next task candidates", {
    eligible: eligible.length,
    total: doc.nodes.length,
  });
  if (eligible.length === 0) return null;

  // Step 2: Build a set of done node IDs for dependency checking
  const doneIds = new Set(
    doc.nodes.filter((n) => n.status === "done").map((n) => n.id),
  );

  // Step 3: Find depends_on edges and filter out nodes with unresolved deps
  const unblocked = eligible.filter((node) => {
    const depsEdges = doc.edges.filter(
      (e) => e.from === node.id && e.relationType === "depends_on",
    );
    // All dependency targets must be done
    return depsEdges.every((e) => doneIds.has(e.to));
  });

  if (unblocked.length === 0) {
    // All eligible tasks have unresolved dependencies — return the one with fewest deps
    const withDepCount = eligible.map((node) => {
      const deps = doc.edges.filter(
        (e) => e.from === node.id && e.relationType === "depends_on" && !doneIds.has(e.to),
      );
      return { node, pendingDeps: deps.length };
    });
    withDepCount.sort((a, b) => a.pendingDeps - b.pendingDeps);
    logger.debug("next:all-blocked", {
      eligibleCount: eligible.length,
      bestPendingDeps: withDepCount[0].pendingDeps,
    });
    return {
      node: withDepCount[0].node,
      reason: `Todas as tasks têm dependências pendentes. Esta tem menos (${withDepCount[0].pendingDeps}).`,
    };
  }

  // Step 4: Topological rank from priority_over edges (Kahn's algorithm)
  const priorityRank = computePriorityRank(unblocked, doc.edges);

  // Step 4.5: Compute blocking impact (how many downstream tasks depend on each)
  const blockingImpact = new Map<string, number>();
  for (const node of unblocked) {
    const impact = doc.edges.filter(
      (e) => e.to === node.id && e.relationType === "depends_on",
    ).length;
    blockingImpact.set(node.id, impact);
  }

  // Step 5: Sort
  unblocked.sort((a, b) => {
    // Priority_over topological rank ASC (lower rank = higher priority)
    const rankA = priorityRank.get(a.id) ?? Infinity;
    const rankB = priorityRank.get(b.id) ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    // Priority ASC (1 = critical, 5 = optional)
    if (a.priority !== b.priority) return a.priority - b.priority;

    // Blocking impact DESC (more downstream = higher priority)
    const impactA = blockingImpact.get(a.id) ?? 0;
    const impactB = blockingImpact.get(b.id) ?? 0;
    if (impactA !== impactB) return impactB - impactA;

    // XP size ASC
    const sizeA = XP_SIZE_ORDER[a.xpSize || "M"] ?? 3;
    const sizeB = XP_SIZE_ORDER[b.xpSize || "M"] ?? 3;
    if (sizeA !== sizeB) return sizeA - sizeB;

    // Estimate ASC
    const estA = a.estimateMinutes ?? 999;
    const estB = b.estimateMinutes ?? 999;
    if (estA !== estB) return estA - estB;

    // Prefer tasks with more acceptance criteria (clearer definition)
    const acA = a.acceptanceCriteria?.length ?? 0;
    const acB = b.acceptanceCriteria?.length ?? 0;
    if (acA !== acB) return acB - acA;

    // CreatedAt ASC (older first)
    return a.createdAt.localeCompare(b.createdAt);
  });

  const best = unblocked[0];
  const reasons: string[] = ["desbloqueada"];
  if (best.priority <= 2) reasons.push("alta prioridade");
  if (best.xpSize && XP_SIZE_ORDER[best.xpSize] <= 2) reasons.push("baixa complexidade");

  logger.debug("next:selected", {
    nodeId: best.id,
    title: best.title,
    priority: best.priority,
    candidatesCount: unblocked.length,
    reason: reasons.join(", "),
  });

  return {
    node: best,
    reason: reasons.join(", "),
  };
}

/**
 * Kahn's algorithm topological sort on priority_over edges.
 * Returns a map of nodeId → rank (0 = highest priority).
 * Nodes in cycles get no rank (treated as Infinity in sort).
 */
function computePriorityRank(
  candidates: GraphNode[],
  edges: GraphEdge[],
): Map<string, number> {
  const candidateIds = new Set(candidates.map((n) => n.id));
  const rank = new Map<string, number>();

  // Filter priority_over edges where both endpoints are in the candidate set
  const relevantEdges = edges.filter(
    (e) =>
      e.relationType === "priority_over" &&
      candidateIds.has(e.from) &&
      candidateIds.has(e.to),
  );

  if (relevantEdges.length === 0) return rank;

  // Build adjacency list and in-degree count
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of candidateIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const edge of relevantEdges) {
    adj.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Kahn's: start with nodes that have 0 in-degree
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let currentRank = 0;
  while (queue.length > 0) {
    const batch = [...queue];
    queue.length = 0;

    for (const id of batch) {
      rank.set(id, currentRank);
      for (const neighbor of adj.get(id) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }
    currentRank++;
  }

  // Nodes still not in rank are part of cycles — they get no rank (Infinity in sort)
  return rank;
}
