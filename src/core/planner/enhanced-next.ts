/**
 * Enhanced Next Task — considers knowledge coverage, velocity data,
 * and dependencies for smarter task recommendations.
 */

import type { GraphDocument, GraphNode } from "../graph/graph-types.js";
import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { findNextTask, type NextTaskResult } from "./next-task.js";
import { calculateVelocity } from "./velocity.js";
import { logger } from "../utils/logger.js";

export interface EnhancedNextResult {
  /** The recommended task */
  task: NextTaskResult;
  /** Knowledge coverage score (0-1) */
  knowledgeCoverage: number;
  /** Historical velocity context */
  velocityContext: {
    avgCompletionHours: number | null;
    estimatedHours: number | null;
  };
  /** Reason for recommendation */
  enhancedReason: string;
}

/**
 * Find the next task with enhanced context from knowledge store and velocity.
 */
export function findEnhancedNextTask(
  doc: GraphDocument,
  store: SqliteStore,
): EnhancedNextResult | null {
  const baseResult = findNextTask(doc);
  if (!baseResult) return null;

  const knowledgeCoverage = assessKnowledgeCoverage(store, baseResult.node);
  const velocityContext = getVelocityContext(doc, baseResult.node);

  const reasons: string[] = [baseResult.reason];

  if (knowledgeCoverage > 0.5) {
    reasons.push(`Good knowledge coverage (${Math.round(knowledgeCoverage * 100)}%)`);
  } else if (knowledgeCoverage < 0.2) {
    reasons.push("Low knowledge coverage — consider adding reference docs");
  }

  if (velocityContext.estimatedHours !== null) {
    reasons.push(`Estimated ~${velocityContext.estimatedHours}h based on velocity`);
  }

  logger.info("Enhanced next task", {
    nodeId: baseResult.node.id,
    knowledgeCoverage,
    estimatedHours: velocityContext.estimatedHours,
  });

  return {
    task: baseResult,
    knowledgeCoverage,
    velocityContext,
    enhancedReason: reasons.join(". "),
  };
}

/**
 * Assess how well a task is covered by knowledge documents.
 * Returns 0-1 score based on FTS matches.
 */
function assessKnowledgeCoverage(store: SqliteStore, node: GraphNode): number {
  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    const totalKnowledge = knowledgeStore.count();
    if (totalKnowledge === 0) return 0;

    const terms = node.title.split(/\s+/).filter((w) => w.length > 2);
    if (terms.length === 0) return 0;

    const query = terms.join(" OR ");
    const results = knowledgeStore.search(query, 5);

    // Score: proportion of terms that got matches, capped at 1
    const matchedTerms = new Set<string>();
    for (const result of results) {
      const contentLower = (result.title + " " + result.content).toLowerCase();
      for (const term of terms) {
        if (contentLower.includes(term.toLowerCase())) {
          matchedTerms.add(term.toLowerCase());
        }
      }
    }

    return Math.min(1, matchedTerms.size / terms.length);
  } catch {
    return 0;
  }
}

/**
 * Get velocity context for estimating task completion time.
 */
function getVelocityContext(
  doc: GraphDocument,
  node: GraphNode,
): { avgCompletionHours: number | null; estimatedHours: number | null } {
  const velocity = calculateVelocity(doc);

  const avgHours = velocity.overall.avgCompletionHours;
  if (avgHours === null) {
    return { avgCompletionHours: null, estimatedHours: null };
  }

  // Estimate based on XP size relative to average
  const XP_MULTIPLIER: Record<string, number> = {
    XS: 0.25, S: 0.5, M: 1, L: 2, XL: 4,
  };
  const multiplier = XP_MULTIPLIER[node.xpSize ?? "M"] ?? 1;
  const estimatedHours = Math.round(avgHours * multiplier * 10) / 10;

  return { avgCompletionHours: avgHours, estimatedHours };
}
