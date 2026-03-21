/**
 * Decision Indexer — captures AI decisions/rationale when tasks complete.
 * Indexes the explicit rationale from update_status(done) into knowledge store.
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

export interface DecisionInput {
  nodeId: string;
  title: string;
  rationale: string;
  tags: string[];
}

export interface IndexResult {
  documentsIndexed: number;
  skippedDuplicates: number;
}

/**
 * Index an AI decision into the knowledge store.
 */
export function indexDecision(
  store: KnowledgeStore,
  decision: DecisionInput,
): IndexResult {
  const content = `# Decision: ${decision.title}\n\n${decision.rationale}`;
  const sourceId = `ai_decision:${decision.nodeId}`;

  const doc = store.insert({
    sourceType: "ai_decision",
    sourceId,
    title: `Decision: ${decision.title}`,
    content,
    metadata: {
      nodeId: decision.nodeId,
      tags: decision.tags,
      phase: "IMPLEMENT",
      indexedAt: new Date().toISOString(),
    },
  });

  // Check if it was a dedup hit (existing doc returned)
  const isNew = doc.sourceId === sourceId;

  logger.info("Decision indexed", { nodeId: decision.nodeId, docId: doc.id, isNew });

  return {
    documentsIndexed: isNew ? 1 : 0,
    skippedDuplicates: isNew ? 0 : 1,
  };
}
