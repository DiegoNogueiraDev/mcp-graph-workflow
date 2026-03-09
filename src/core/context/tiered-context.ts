/**
 * Tiered Context Builder — provides 3 levels of detail for node context.
 *
 * Tier 1 (summary):  ~20 tok/node  — title + status + type
 * Tier 2 (standard): ~150 tok/node — compact TaskContext
 * Tier 3 (deep):     ~500+ tok/node — full context + knowledge docs
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode } from "../graph/graph-types.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { buildTaskContext, type TaskContext } from "./compact-context.js";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";

export type ContextTier = "summary" | "standard" | "deep";

export interface TieredNodeSummary {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: number;
}

export interface TieredContext {
  tier: ContextTier;
  nodeId: string;
  summary: TieredNodeSummary;
  taskContext?: TaskContext;
  knowledgeSnippets?: Array<{
    title: string;
    content: string;
    sourceType: string;
    score: number;
  }>;
  estimatedTokens: number;
}

/**
 * Build context at the specified tier level.
 */
export function buildTieredContext(
  store: SqliteStore,
  nodeId: string,
  tier: ContextTier = "standard",
): TieredContext | null {
  const node = store.getNodeById(nodeId);
  if (!node) return null;

  const summary: TieredNodeSummary = {
    id: node.id,
    type: node.type,
    title: node.title,
    status: node.status,
    priority: node.priority,
  };

  if (tier === "summary") {
    const text = JSON.stringify(summary);
    return {
      tier,
      nodeId,
      summary,
      estimatedTokens: estimateTokens(text),
    };
  }

  if (tier === "standard") {
    const taskContext = buildTaskContext(store, nodeId);
    if (!taskContext) return null;

    return {
      tier,
      nodeId,
      summary,
      taskContext,
      estimatedTokens: taskContext.metrics.estimatedTokens,
    };
  }

  // tier === "deep"
  const taskContext = buildTaskContext(store, nodeId);
  if (!taskContext) return null;

  // Include relevant knowledge docs
  const knowledgeSnippets = findRelevantKnowledge(store, node);

  const deepPayload = {
    tier,
    nodeId,
    summary,
    taskContext,
    knowledgeSnippets: knowledgeSnippets.length > 0 ? knowledgeSnippets : undefined,
    estimatedTokens: 0,
  };

  const text = JSON.stringify(deepPayload);
  deepPayload.estimatedTokens = estimateTokens(text);

  logger.debug("Tiered context built", { nodeId, tier, tokens: deepPayload.estimatedTokens });

  return deepPayload;
}

/**
 * Find knowledge documents relevant to a node.
 */
function findRelevantKnowledge(
  store: SqliteStore,
  node: GraphNode,
): Array<{ title: string; content: string; sourceType: string; score: number }> {
  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    // Build search terms: title words + tags, joined with OR for broader matching
    const terms = [
      ...node.title.split(/\s+/).filter((w) => w.length > 2),
      ...(node.tags ?? []),
    ];
    const query = terms.join(" OR ");
    if (!query.trim()) return [];

    const results = knowledgeStore.search(query, 3);

    return results.map((r) => ({
      title: r.title,
      content: r.content.length > 500 ? r.content.slice(0, 500) + "..." : r.content,
      sourceType: r.sourceType,
      score: Math.round(r.score * 1000) / 1000,
    }));
  } catch {
    return [];
  }
}
