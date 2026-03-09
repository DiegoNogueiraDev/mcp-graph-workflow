/**
 * RAG Context Builder — builds a compact context from search results
 * suitable for LLM consumption with token budget management.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode } from "../graph/graph-types.js";
import { searchNodes } from "../search/fts-search.js";
import { buildTaskContext, type TaskContext } from "./compact-context.js";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";

export interface RagContext {
  query: string;
  relevantNodes: RagNodeSummary[];
  expandedContexts: TaskContext[];
  tokenUsage: {
    budget: number;
    used: number;
    remaining: number;
  };
}

interface RagNodeSummary {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: number;
  description?: string;
  tags?: string[];
  score: number;
}

/**
 * Build a RAG context from a natural language query.
 *
 * 1. Search for relevant nodes via FTS5
 * 2. Expand subgraph context for top results via buildTaskContext
 * 3. Manage token budget to stay within limits
 */
export function ragBuildContext(
  store: SqliteStore,
  query: string,
  tokenBudget: number = 4000,
): RagContext {
  logger.info(`RAG context: query="${query}", budget=${tokenBudget} tokens`);

  // Stage 1: Search for relevant nodes with TF-IDF reranking
  const searchResults = searchNodes(store, query, { limit: 10, rerank: true });

  const relevantNodes: RagNodeSummary[] = searchResults.map((r) => {
    const summary: RagNodeSummary = {
      id: r.node.id,
      type: r.node.type,
      title: r.node.title,
      status: r.node.status,
      priority: r.node.priority,
      score: Math.round(r.score * 1000) / 1000,
    };
    if (r.node.description) summary.description = r.node.description;
    if (r.node.tags?.length) summary.tags = r.node.tags;
    return summary;
  });

  // Stage 2: Expand context for top results within budget
  const expandedContexts: TaskContext[] = [];
  let tokensUsed = estimateTokens(JSON.stringify({ query, relevantNodes }));

  for (const result of searchResults) {
    if (tokensUsed >= tokenBudget) break;

    const ctx = buildTaskContext(store, result.node.id);
    if (!ctx) continue;

    const ctxTokens = ctx.metrics.estimatedTokens;
    if (tokensUsed + ctxTokens > tokenBudget) {
      // Check if we have room for at least one more context
      if (expandedContexts.length === 0) {
        // Always include at least one context even if over budget
        expandedContexts.push(ctx);
        tokensUsed += ctxTokens;
      }
      break;
    }

    expandedContexts.push(ctx);
    tokensUsed += ctxTokens;
  }

  logger.info(`RAG context built: ${relevantNodes.length} nodes, ${expandedContexts.length} expanded, ${tokensUsed}/${tokenBudget} tokens`);

  return {
    query,
    relevantNodes,
    expandedContexts,
    tokenUsage: {
      budget: tokenBudget,
      used: tokensUsed,
      remaining: Math.max(0, tokenBudget - tokensUsed),
    },
  };
}
