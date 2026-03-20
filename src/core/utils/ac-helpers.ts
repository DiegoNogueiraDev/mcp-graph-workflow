/**
 * AC (Acceptance Criteria) helpers — centralized utility for gathering AC
 * from both inline fields and child acceptance_criteria nodes.
 */

import type { GraphDocument } from "../graph/graph-types.js";

/**
 * Get all AC texts for a node — prefers inline AC, falls back to child AC node titles.
 */
export function getNodeAcTexts(doc: GraphDocument, nodeId: string): string[] {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  const inline = node.acceptanceCriteria ?? [];
  if (inline.length > 0) return inline;

  // Fallback: AC child nodes by parentId
  return doc.nodes
    .filter((n) => n.type === "acceptance_criteria" && n.parentId === nodeId)
    .map((n) => n.title);
}

/**
 * Check if a node has any AC — either inline or via child AC nodes.
 */
export function nodeHasAc(doc: GraphDocument, nodeId: string): boolean {
  return getNodeAcTexts(doc, nodeId).length > 0;
}
