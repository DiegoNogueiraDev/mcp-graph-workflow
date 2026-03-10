/**
 * Pure utility functions for graph node filtering.
 * Shared between Graph Tab, PRD Backlog Tab, and tests.
 * No React/DOM dependencies — fully testable.
 */

export const TOP_LEVEL_TYPES: ReadonlySet<string> = new Set([
  "epic",
  "milestone",
  "requirement",
  "constraint",
]);

/**
 * Filter nodes to show only top-level types or nodes without a parent.
 * When showFullGraph is true, returns all nodes unchanged.
 */
export function filterTopLevelNodes<T extends { type: string; parentId?: string | null }>(
  nodes: T[],
  showFullGraph: boolean,
): T[] {
  if (showFullGraph) return nodes;
  return nodes.filter((n) => TOP_LEVEL_TYPES.has(n.type) || !n.parentId);
}
