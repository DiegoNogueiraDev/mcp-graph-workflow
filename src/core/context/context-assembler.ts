/**
 * Context Assembler — combines graph context + knowledge + memories + docs
 * with token accounting per section. Produces a structured, budgeted context
 * suitable for LLM consumption.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { buildTieredContext, type ContextTier } from "./tiered-context.js";
import { compressWithBm25 } from "./bm25-compressor.js";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";
import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

export interface AssembledContext {
  /** The query used to assemble context */
  query: string;
  /** Tier used for node context */
  tier: ContextTier;
  /** Assembled sections with token accounting */
  sections: ContextSection[];
  /** Token usage breakdown */
  tokenUsage: {
    budget: number;
    used: number;
    remaining: number;
    breakdown: Record<string, number>;
  };
}

export interface ContextSection {
  name: string;
  source: string;
  content: string;
  tokens: number;
}

export interface AssemblerOptions {
  /** Total token budget (default: 4000) */
  tokenBudget?: number;
  /** Context tier (default: "standard") */
  tier?: ContextTier;
  /** Node IDs to include (if empty, uses FTS search) */
  nodeIds?: string[];
  /** Max knowledge chunks to include (default: 5) */
  maxKnowledgeChunks?: number;
  /** Current lifecycle phase for phase-aware knowledge boosting */
  phase?: LifecyclePhase;
}

/**
 * Assemble a multi-source context with token budgeting.
 */
export function assembleContext(
  store: SqliteStore,
  query: string,
  options?: AssemblerOptions,
): AssembledContext {
  const tokenBudget = options?.tokenBudget ?? 4000;
  const tier = options?.tier ?? "standard";
  const maxKnowledgeChunks = options?.maxKnowledgeChunks ?? 5;

  const sections: ContextSection[] = [];
  const breakdown: Record<string, number> = {};
  let tokensUsed = 0;

  // Budget allocation: 60% graph, 30% knowledge, 10% header
  const graphBudget = Math.floor(tokenBudget * 0.6);
  const knowledgeBudget = Math.floor(tokenBudget * 0.3);

  // Section 1: Graph context for specified or searched nodes
  const nodeIds = options?.nodeIds ?? findRelevantNodeIds(store, query);

  for (const nodeId of nodeIds) {
    if (tokensUsed >= graphBudget) break;

    const ctx = buildTieredContext(store, nodeId, tier);
    if (!ctx) continue;

    if (tokensUsed + ctx.estimatedTokens > graphBudget && sections.length > 0) break;

    const content = JSON.stringify(ctx, null, 0);
    const tokens = estimateTokens(content);

    sections.push({
      name: `node:${ctx.summary.title}`,
      source: "graph",
      content,
      tokens,
    });

    tokensUsed += tokens;
  }

  breakdown.graph = tokensUsed;

  // Section 2: Knowledge context (BM25-compressed, phase-aware)
  const knowledgeTokensBefore = tokensUsed;
  const phase = options?.phase;

  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    const kResults = phase
      ? knowledgeStore.searchWithPhaseBoost(query, phase, maxKnowledgeChunks * 2)
      : knowledgeStore.search(query, maxKnowledgeChunks * 2);

    if (kResults.length > 0) {
      const chunks = kResults.map((r) => `[${r.sourceType}] ${r.title}: ${r.content}`);
      const compressed = compressWithBm25(chunks, query, knowledgeBudget);

      for (const chunk of compressed) {
        if (tokensUsed + chunk.tokens > tokenBudget && sections.length > 0) break;

        sections.push({
          name: `knowledge:${chunk.content.slice(0, 40)}...`,
          source: "knowledge",
          content: chunk.content,
          tokens: chunk.tokens,
        });

        tokensUsed += chunk.tokens;
      }
    }
  } catch {
    logger.debug("Knowledge search unavailable during assembly");
  }

  breakdown.knowledge = tokensUsed - knowledgeTokensBefore;

  logger.debug("context:breakdown", {
    graphTokens: breakdown.graph,
    knowledgeTokens: breakdown.knowledge,
    sections: sections.map((s) => `${s.name}:${s.tokens}`).join(", "),
  });

  if (tokensUsed > tokenBudget) {
    logger.warn("context:budget-exceeded", { tokensUsed, tokenBudget, overage: tokensUsed - tokenBudget });
  }

  const truncatedSections = nodeIds.length - sections.filter((s) => s.source === "graph").length;
  if (truncatedSections > 0) {
    logger.warn("context:sections-truncated", { truncatedSections, reason: "token budget" });
  }

  logger.info("Context assembled", {
    query: query.slice(0, 50),
    tier,
    sections: sections.length,
    tokensUsed,
    budget: tokenBudget,
  });

  return {
    query,
    tier,
    sections,
    tokenUsage: {
      budget: tokenBudget,
      used: tokensUsed,
      remaining: Math.max(0, tokenBudget - tokensUsed),
      breakdown,
    },
  };
}

/**
 * Find relevant node IDs via FTS search.
 */
function findRelevantNodeIds(store: SqliteStore, query: string): string[] {
  try {
    const results = store.searchNodes(query, 5);
    return results.map((r) => r.id);
  } catch {
    return [];
  }
}
