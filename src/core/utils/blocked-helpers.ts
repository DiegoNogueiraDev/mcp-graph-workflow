/**
 * Shared blocked task detection — merges dependency-based and status-based blocked tasks.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { detectBottlenecks } from "../insights/bottleneck-detector.js";
import { TASK_TYPES } from "./node-type-sets.js";

export interface BlockedTaskSummary {
  id: string;
  title: string;
}

/**
 * Find all blocked tasks: dependency-based (from detectBottlenecks) + status-based.
 * Deduplicates to avoid counting a task twice.
 */
export function findAllBlockedTasks(doc: GraphDocument): BlockedTaskSummary[] {
  const bottlenecks = detectBottlenecks(doc);
  const bottleneckIds = new Set(bottlenecks.blockedTasks.map((b) => b.id));
  const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
  const statusBlocked = tasks
    .filter((n) => (n.status === "blocked" || n.blocked === true) && !bottleneckIds.has(n.id))
    .map((n) => ({ id: n.id, title: n.title }));
  // Bug #092: final dedup by ID to prevent any duplicate entries
  const merged = [...bottlenecks.blockedTasks.map((b) => ({ id: b.id, title: b.title })), ...statusBlocked];
  const seen = new Set<string>();
  return merged.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}
