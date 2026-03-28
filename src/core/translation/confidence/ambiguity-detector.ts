/**
 * Ambiguity Detector — identifies constructs that need AI assistance.
 *
 * Takes scored constructs and classifies ambiguity:
 * - multiple_targets: construct has >1 viable target mapping
 * - no_target: construct has no valid target mapping
 * - lossy_translation: single target but low confidence (information loss likely)
 *
 * Feeds the prompt-builder with precise context for AI-assisted translation.
 */

import { ConstructRegistry } from "../ucr/construct-registry.js";
import type { TranslationScore, AmbiguityReport } from "../ucr/construct-types.js";
import { AmbiguityCandidateSchema } from "../ucr/construct-types.js";
import { z } from "zod/v4";

type AmbiguityCandidate = z.infer<typeof AmbiguityCandidateSchema>;

const LOSSY_THRESHOLD = 0.65;

/**
 * Detect ambiguities in scored constructs.
 * Returns reports only for constructs that have translation issues.
 */
export function detectAmbiguities(
  scores: TranslationScore[],
  registry: ConstructRegistry,
  sourceLang: string,
  targetLang: string,
): AmbiguityReport[] {
  const reports: AmbiguityReport[] = [];

  for (const score of scores) {
    const report = analyzeScore(score, registry, sourceLang, targetLang);
    if (report) reports.push(report);
  }

  return reports;
}

function analyzeScore(
  score: TranslationScore,
  registry: ConstructRegistry,
  _sourceLang: string,
  targetLang: string,
): AmbiguityReport | null {
  // no_target: no valid mapping selected
  if (!score.selectedMappingId) {
    return buildReport(score, registry, "no_target", []);
  }

  // Get all target mappings to check for multiple options
  const allMappings = registry.getMappings(score.constructId, targetLang);

  // multiple_targets: more than one viable target mapping
  if (allMappings.length > 1) {
    const candidates: AmbiguityCandidate[] = allMappings.map((m) => ({
      mappingId: m.id,
      confidence: m.confidence,
      tradeoff: m.syntaxPattern
        ? `Pattern: ${m.syntaxPattern.split("\n")[0]}`
        : `Confidence: ${m.confidence}`,
    }));

    return buildReport(score, registry, "multiple_targets", candidates);
  }

  // lossy_translation: single target but low confidence
  if (score.finalConfidence < LOSSY_THRESHOLD) {
    const candidates: AmbiguityCandidate[] = allMappings.map((m) => ({
      mappingId: m.id,
      confidence: m.confidence,
      tradeoff: `Low confidence (${m.confidence}) — potential information loss`,
    }));

    return buildReport(score, registry, "lossy_translation", candidates);
  }

  // No ambiguity — exact or high-confidence single mapping
  return null;
}

function buildReport(
  score: TranslationScore,
  registry: ConstructRegistry,
  ambiguityType: "multiple_targets" | "no_target" | "lossy_translation",
  candidates: AmbiguityCandidate[],
): AmbiguityReport {
  const construct = registry.getConstructById(score.constructId);
  const canonicalName = construct?.canonicalName ?? score.constructId;

  return {
    constructId: score.constructId,
    canonicalName,
    ambiguityType,
    candidates,
    recommendation: generateRecommendation(ambiguityType, candidates),
  };
}

function generateRecommendation(
  ambiguityType: "multiple_targets" | "no_target" | "lossy_translation",
  candidates: AmbiguityCandidate[],
): string {
  switch (ambiguityType) {
    case "multiple_targets": {
      const best = candidates.reduce((a, b) => (a.confidence >= b.confidence ? a : b), candidates[0]);
      return best
        ? `Prefer mapping ${best.mappingId} (confidence: ${best.confidence}). Review alternatives.`
        : "Multiple options available — AI should evaluate context.";
    }
    case "no_target":
      return "No equivalent construct in target language. AI must synthesize a workaround.";
    case "lossy_translation":
      return "Translation possible but lossy. AI should validate semantic preservation.";
  }
}
