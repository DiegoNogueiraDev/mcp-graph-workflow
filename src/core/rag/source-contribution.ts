/**
 * Source Contribution — measures how much each knowledge source
 * contributes to RAG quality.
 *
 * Aggregates data from traces and usage logs to compute per-source metrics.
 */

import { logger } from "../utils/logger.js";

export interface TraceAggregation {
  sourceType: string;
  retrievalCount: number;
  totalRelevanceScore: number;
  helpfulCount: number;
  unhelpfulCount: number;
  totalTokens: number;
}

export interface SourceContribution {
  sourceType: string;
  documentCount: number;
  retrievalHitRate: number;
  avgRelevanceScore: number;
  helpfulFeedbackRate: number;
  tokenContribution: number;
}

export interface UnderutilizedSource {
  sourceType: string;
  reason: string;
  documentCount: number;
  retrievalHitRate: number;
}

const LOW_HIT_RATE_THRESHOLD = 0.05;

/**
 * Calculate contribution metrics for each source type.
 */
export function calculateSourceContributions(
  traces: TraceAggregation[],
  totalQueries: number,
): SourceContribution[] {
  if (traces.length === 0) return [];

  const totalTokens = traces.reduce((sum, t) => sum + t.totalTokens, 0);

  return traces.map((t) => {
    const feedbackTotal = t.helpfulCount + t.unhelpfulCount;

    return {
      sourceType: t.sourceType,
      documentCount: 0, // Populated by caller from knowledge store count
      retrievalHitRate: totalQueries > 0
        ? t.retrievalCount / totalQueries
        : 0,
      avgRelevanceScore: t.retrievalCount > 0
        ? t.totalRelevanceScore / t.retrievalCount
        : 0,
      helpfulFeedbackRate: feedbackTotal > 0
        ? t.helpfulCount / feedbackTotal
        : 0,
      tokenContribution: totalTokens > 0
        ? t.totalTokens / totalTokens
        : 0,
    };
  });
}

/**
 * Identify sources that are indexed but rarely retrieved.
 */
export function identifyUnderutilizedSources(
  contributions: SourceContribution[],
): UnderutilizedSource[] {
  const underutilized: UnderutilizedSource[] = [];

  for (const c of contributions) {
    if (c.retrievalHitRate < LOW_HIT_RATE_THRESHOLD && c.documentCount > 0) {
      underutilized.push({
        sourceType: c.sourceType,
        reason: `Low retrieval hit rate (${(c.retrievalHitRate * 100).toFixed(1)}%). Documents indexed: ${c.documentCount}. Consider reindexing or improving keyword coverage.`,
        documentCount: c.documentCount,
        retrievalHitRate: c.retrievalHitRate,
      });
    }
  }

  logger.debug("Underutilized sources identified", { count: underutilized.length });

  return underutilized;
}
