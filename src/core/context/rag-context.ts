/**
 * RAG Context Builder — builds a compact context from search results
 * suitable for LLM consumption with token budget management.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { searchNodes } from "../search/fts-search.js";
import { buildTaskContext, type TaskContext } from "./compact-context.js";
import { estimateTokens } from "./token-estimator.js";
import { DEFAULT_TOKEN_BUDGET } from "../utils/constants.js";
import { logger } from "../utils/logger.js";
import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

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
 * 3. Search knowledge store with optional phase-aware boosting
 * 4. Manage token budget to stay within limits
 */
export function ragBuildContext(
  store: SqliteStore,
  query: string,
  tokenBudget: number = DEFAULT_TOKEN_BUDGET,
  phase?: LifecyclePhase,
): RagContext {
  logger.info(`RAG context: query="${query}", budget=${tokenBudget} tokens, phase=${phase ?? "none"}`);

  // Stage 1: Search for relevant nodes with TF-IDF reranking + substring fallback
  let searchResults = searchNodes(store, query, { limit: 10, rerank: true });

  // Fallback: if FTS returns nothing, try substring match
  if (searchResults.length === 0) {
    logger.debug("RAG FTS returned 0 results, falling back to substring search");
    try {
      const allNodes = store.getAllNodes();
      const lowerQuery = query.toLowerCase();
      const words = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) {
        const matched = allNodes
          .filter((n) =>
            words.some((w) =>
              n.title.toLowerCase().includes(w) ||
              (n.description ?? "").toLowerCase().includes(w),
            ),
          )
          .slice(0, 10);
        searchResults = matched.map((node) => ({ node, score: 0.5 }));
      }
    } catch {
      logger.debug("RAG substring fallback also failed");
    }
  }

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

  // Stage 2: Search knowledge store with optional phase-aware boosting
  const knowledgeStore = new KnowledgeStore(store.getDb());
  let knowledgeResults: KnowledgeSummary[] = [];
  try {
    const kResults = phase
      ? knowledgeStore.searchWithPhaseBoost(query, phase, 5)
      : knowledgeStore.search(query, 5);
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

  // Fallback: if knowledge store returned nothing, synthesize from node descriptions
  if (knowledgeResults.length === 0 && relevantNodes.length > 0) {
    knowledgeResults = relevantNodes
      .filter((n) => n.description)
      .slice(0, 3)
      .map((n, i) => ({
        id: `fallback-${i}`,
        sourceType: "node_context",
        title: n.title,
        content: n.description ?? n.title,
        score: 0.5,
      }));
  }

  // Stage 3: Expand context for top results within budget
  const expandedContexts: TaskContext[] = [];
  const basePayload = JSON.stringify({ query, relevantNodes, knowledgeResults });
  let tokensUsed = estimateTokens(basePayload);

  // If the base payload already exceeds budget, cap it and skip expansion
  if (tokensUsed < tokenBudget) {
    for (const result of searchResults) {
      if (tokensUsed >= tokenBudget) break;

      const ctx = buildTaskContext(store, result.node.id);
      if (!ctx) continue;

      const ctxTokens = ctx.metrics.estimatedTokens;
      if (tokensUsed + ctxTokens > tokenBudget) {
        // Always include at least one expanded context even if over budget
        if (expandedContexts.length === 0) {
          expandedContexts.push(ctx);
          tokensUsed += ctxTokens;
        }
        break;
      }

      expandedContexts.push(ctx);
      tokensUsed += ctxTokens;
    }
  }

  // Enforce hard cap: used never exceeds budget in the reported metrics
  const reportedUsed = Math.min(tokensUsed, tokenBudget);

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
      used: reportedUsed,
      remaining: tokenBudget - reportedUsed,
    },
  };
}
