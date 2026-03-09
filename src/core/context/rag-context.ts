/**
 * RAG Context Builder — builds a compact context from search results
 * suitable for LLM consumption with token budget management.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode } from "../graph/graph-types.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import type { KnowledgeDocument } from "../../schemas/knowledge.schema.js";
import { searchNodes } from "../search/fts-search.js";
import { buildTaskContext, type TaskContext } from "./compact-context.js";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";

export interface KnowledgeSummary {
  id: string;
  sourceType: string;
  title: string;
  content: string;
  score: number;
}

export interface RagContext {
  query: string;
  relevantNodes: RagNodeSummary[];
  knowledgeResults: KnowledgeSummary[];
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

  // Stage 2: Search knowledge store for additional context
  const knowledgeStore = new KnowledgeStore(store.getDb());
  let knowledgeResults: KnowledgeSummary[] = [];
  try {
    const kResults = knowledgeStore.search(query, 5);
    knowledgeResults = kResults.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      title: r.title,
      content: r.content.length > 500 ? r.content.slice(0, 500) + "..." : r.content,
      score: Math.round(r.score * 1000) / 1000,
    }));
  } catch {
    // Knowledge search may fail if no knowledge docs exist — that's OK
    logger.debug("Knowledge FTS search returned no results or errored");
  }

  // Stage 3: Expand context for top results within budget
  const expandedContexts: TaskContext[] = [];
  let tokensUsed = estimateTokens(JSON.stringify({ query, relevantNodes, knowledgeResults }));

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

  logger.info(
    `RAG context built: ${relevantNodes.length} nodes, ${knowledgeResults.length} knowledge, ${expandedContexts.length} expanded, ${tokensUsed}/${tokenBudget} tokens`,
  );

  return {
    query,
    relevantNodes,
    knowledgeResults,
    expandedContexts,
    tokenUsage: {
      budget: tokenBudget,
      used: tokensUsed,
      remaining: Math.max(0, tokenBudget - tokensUsed),
    },
  };
}
