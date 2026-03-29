/**
 * Shared circularity check for parent-child relationships.
 * Used by node.ts, clone-node.ts, and move-node.ts to prevent circular references.
 */

import type { SqliteStore } from "../store/sqlite-store.js";

/**
 * Check if setting `parentId` as parent of `nodeId` would create a circular reference.
 * Walks up from parentId to root; if it encounters nodeId, that's a cycle.
 *
 * @returns null if safe, or an error message string if circular
 */
export function checkCircularity(
  store: SqliteStore,
  nodeId: string,
  parentId: string | null | undefined,
): string | null {
  if (parentId === undefined || parentId === null) return null;

  // Self-parenting
  if (parentId === nodeId) {
    return "A node cannot be its own parent";
  }

  // Walk up ancestor chain
  let ancestor = store.getNodeById(parentId);
  while (ancestor?.parentId) {
    if (ancestor.parentId === nodeId) {
      return "Circular reference detected: target parent is a descendant of this node";
    }
    ancestor = store.getNodeById(ancestor.parentId);
    if (!ancestor) break;
  }

  return null;
}
