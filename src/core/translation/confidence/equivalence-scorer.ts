/**
 * Equivalence Scorer — computes composite translation confidence per construct.
 *
 * Score = weighted(static, contextual)
 * - static: UCR mapping confidence (min of source + target)
 * - contextual: constraint satisfaction ratio
 *
 * Constructs with finalConfidence >= UCR_CONFIDENCE_THRESHOLD → deterministic
 * Constructs with finalConfidence < UCR_CONFIDENCE_THRESHOLD → needsAiAssist
 */

import { ConstructRegistry } from "../ucr/construct-registry.js";
import type { TranslationScore } from "../ucr/construct-types.js";
import { UCR_CONFIDENCE_THRESHOLD } from "../../utils/constants.js";

const STATIC_WEIGHT = 0.7;
const CONTEXTUAL_WEIGHT = 0.3;

/**
 * Score a single construct for translation between source and target languages.
 * Returns null if no translation path exists.
 */
export function scoreConstruct(
  registry: ConstructRegistry,
  constructId: string,
  sourceLang: string,
  targetLang: string,
): TranslationScore | null {
  const path = registry.findTranslationPath(constructId, sourceLang, targetLang);
  if (!path) return null;

  const staticConfidence = path.confidence;

  // Contextual: evaluate constraint satisfaction on target mapping
  const contextualConfidence = computeContextualConfidence(path.targetMapping.constraints);

  const finalConfidence = STATIC_WEIGHT * staticConfidence + CONTEXTUAL_WEIGHT * contextualConfidence;
  const needsAiAssist = finalConfidence < UCR_CONFIDENCE_THRESHOLD;

  const alternatives = path.alternatives.map((alt) => ({
    mappingId: alt.id,
    confidence: alt.confidence,
    reason: alt.syntaxPattern
      ? `Alternative pattern: ${alt.syntaxPattern}`
      : `Alternative mapping (confidence: ${alt.confidence})`,
  }));

  return {
    constructId,
    staticConfidence,
    contextualConfidence,
    finalConfidence,
    selectedMappingId: path.targetMapping.id,
    alternatives,
    needsAiAssist,
  };
}

/**
 * Score multiple constructs in batch. Skips constructs with no translation path.
 */
export function scoreConstructs(
  registry: ConstructRegistry,
  constructIds: string[],
  sourceLang: string,
  targetLang: string,
): TranslationScore[] {
  const results: TranslationScore[] = [];
  for (const id of constructIds) {
    const score = scoreConstruct(registry, id, sourceLang, targetLang);
    if (score) results.push(score);
  }
  return results;
}

/**
 * Compute contextual confidence from constraint evaluation.
 * Empty/no constraints → full confidence (no restrictions).
 * Each constraint key reduces confidence slightly
 * since constraints indicate translation caveats.
 */
function computeContextualConfidence(constraints: Record<string, unknown> | undefined): number {
  if (!constraints) return 1.0;
  const keys = Object.keys(constraints);
  if (keys.length === 0) return 1.0;
  // Each constraint reduces confidence by a diminishing factor
  const penalty = Math.min(keys.length * 0.1, 0.5);
  return 1.0 - penalty;
}
