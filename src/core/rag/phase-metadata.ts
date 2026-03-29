/**
 * Phase metadata utilities for knowledge indexers.
 * Provides consistent phase tagging across all knowledge sources.
 */

import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

/**
 * Phase boost weights for RAG search.
 * Maps: current phase → source phase → boost multiplier.
 * Higher boost = more relevant for the current phase.
 */
export const PHASE_BOOST_WEIGHTS: Record<LifecyclePhase, Partial<Record<LifecyclePhase, number>>> = {
  ANALYZE: {
    ANALYZE: 2.0,
    LISTENING: 1.5,
  },
  DESIGN: {
    DESIGN: 2.0,
    ANALYZE: 1.5,
    PLAN: 1.2,
  },
  PLAN: {
    PLAN: 2.0,
    DESIGN: 1.5,
    ANALYZE: 1.3,
  },
  IMPLEMENT: {
    IMPLEMENT: 2.0,
    PLAN: 1.5,
    DESIGN: 1.2,
  },
  VALIDATE: {
    VALIDATE: 2.0,
    IMPLEMENT: 2.0,
    ANALYZE: 1.3,
  },
  REVIEW: {
    REVIEW: 2.0,
    IMPLEMENT: 1.5,
    VALIDATE: 2.0,
  },
  HANDOFF: {
    HANDOFF: 2.0,
    REVIEW: 1.5,
    VALIDATE: 1.3,
  },
  DEPLOY: {
    DEPLOY: 2.0,
    HANDOFF: 1.5,
    REVIEW: 1.3,
  },
  LISTENING: {
    LISTENING: 2.0,
    ANALYZE: 1.5,
    VALIDATE: 1.3,
  },
};

/**
 * Get the phase boost multiplier for a knowledge document in the current phase.
 * Returns 1.0 (neutral) if no specific boost is defined.
 */
export function getPhaseBoost(currentPhase: LifecyclePhase, docPhase: string | undefined): number {
  if (!docPhase) return 1.0;
  const weights = PHASE_BOOST_WEIGHTS[currentPhase];
  return weights[docPhase as LifecyclePhase] ?? 1.0;
}

/**
 * Apply phase boost to a BM25 score.
 * Scores are positive (higher = better match) after negation in the store layer.
 * Boosting means multiplying by the weight (making score higher = more relevant).
 */
export function applyPhaseBoost(score: number, boost: number): number {
  if (boost <= 0) return score;
  return score * boost;
}
