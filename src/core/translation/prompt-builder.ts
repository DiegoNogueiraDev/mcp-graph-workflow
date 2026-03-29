/**
 * Prompt Builder — generates structured LLM prompts for code translation.
 *
 * 4 prompt types:
 * - mapping: analyze constructs and determine best mapping strategy
 * - translation: full code translation with construct context
 * - syntactic repair: fix syntax errors in generated code
 * - semantic repair: fix semantic issues preserving meaning
 */

import type { TranslationScore, AmbiguityReport } from "./ucr/construct-types.js";
import { estimateTokens } from "../context/token-estimator.js";

/** Default max prompt token budget (~32KB). */
const DEFAULT_MAX_PROMPT_TOKENS = 8000;

/** Max constructs to show in the table when truncating. */
const MAX_CONSTRUCTS_ON_TRUNCATE = 20;

export interface PromptContext {
  sourceLanguage: string;
  targetLanguage: string;
  sourceCode: string;
  scores: TranslationScore[];
  ambiguities: AmbiguityReport[];
  /** Max prompt token budget (default: 8000). */
  maxPromptTokens?: number;
}

/**
 * Build a mapping prompt — asks the LLM to analyze constructs and choose mappings.
 */
export function buildMappingPrompt(ctx: PromptContext): string {
  const sections: string[] = [
    `## Construct Mapping Analysis`,
    ``,
    `**Source language**: ${ctx.sourceLanguage}`,
    `**Target language**: ${ctx.targetLanguage}`,
    ``,
    `### Detected Constructs`,
    ``,
    formatScoresTable(ctx.scores),
  ];

  if (ctx.ambiguities.length > 0) {
    sections.push(``, `### Ambiguities Requiring Decision`, ``);
    for (const amb of ctx.ambiguities) {
      sections.push(
        `- **${amb.canonicalName ?? amb.constructId}** (${amb.ambiguityType}): ${amb.candidates.length} candidates`,
      );
      for (const c of amb.candidates) {
        sections.push(`  - ${c.tradeoff} (confidence: ${c.confidence})`);
      }
      if (amb.recommendation) {
        sections.push(`  → Recommendation: ${amb.recommendation}`);
      }
    }
  }

  sections.push(
    ``,
    `### Instructions`,
    `For each construct above, confirm or override the selected mapping.`,
    `For ambiguous constructs, justify your choice.`,
  );

  return sections.join("\n");
}

/**
 * Build a full translation prompt — asks the LLM to translate the code.
 */
export function buildTranslationPrompt(ctx: PromptContext): string {
  const maxTokens = ctx.maxPromptTokens ?? DEFAULT_MAX_PROMPT_TOKENS;
  let truncated = false;

  // Possibly truncate scores to top N by count (we don't have count here, so limit by total)
  let effectiveScores = ctx.scores;
  if (effectiveScores.length > MAX_CONSTRUCTS_ON_TRUNCATE) {
    // Sort by finalConfidence desc, keep top N
    effectiveScores = [...effectiveScores]
      .sort((a, b) => b.finalConfidence - a.finalConfidence)
      .slice(0, MAX_CONSTRUCTS_ON_TRUNCATE);
    truncated = true;
  }

  const deterministicCount = effectiveScores.filter((s) => !s.needsAiAssist).length;
  const aiAssistCount = effectiveScores.filter((s) => s.needsAiAssist).length;

  // Possibly truncate source code to fit budget
  let sourceBlock = ctx.sourceCode;
  const sourceLines = ctx.sourceCode.split("\n");

  const sections: string[] = [
    `## Code Translation: ${ctx.sourceLanguage} → ${ctx.targetLanguage}`,
    ``,
    `### Source Code`,
    "```" + ctx.sourceLanguage,
    sourceBlock,
    "```",
    ``,
    `### Construct Analysis`,
    `- **Deterministic mappings**: ${deterministicCount} (high confidence, direct translation)`,
    `- **AI-assisted mappings**: ${aiAssistCount} (require judgment)`,
    ``,
    formatScoresTable(effectiveScores),
  ];

  if (aiAssistCount > 0) {
    sections.push(``, `### Constructs Requiring AI Judgment`);
    for (const score of effectiveScores.filter((s) => s.needsAiAssist)) {
      sections.push(
        `- **${score.constructId}** (confidence: ${score.finalConfidence.toFixed(2)})`,
      );
      if (score.alternatives.length > 0) {
        for (const alt of score.alternatives) {
          sections.push(`  - Alternative: ${alt.reason} (${alt.confidence})`);
        }
      }
    }
  }

  if (ctx.ambiguities.length > 0) {
    sections.push(``, `### Ambiguity Warnings`);
    for (const amb of ctx.ambiguities) {
      const name = amb.canonicalName ?? amb.constructId;
      sections.push(`- **${name}**: ${amb.ambiguityType} — ${amb.recommendation ?? "review needed"}`);
    }
  }

  sections.push(
    ``,
    `### Instructions`,
    `Translate the source code to ${ctx.targetLanguage}.`,
    `Use the construct mappings above. For AI-assisted constructs, choose the best mapping.`,
    `Preserve semantics, follow ${ctx.targetLanguage} conventions (naming, idioms).`,
    `Return ONLY the translated code.`,
  );

  // Check token budget — if over, truncate source code block
  let result = sections.join("\n");
  if (estimateTokens(result) > maxTokens) {
    // Binary search for max lines that fit within budget
    let lo = 1;
    let hi = sourceLines.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = sourceLines.slice(0, mid).join("\n")
        + `\n... [truncated — showing first ${mid} lines of ${sourceLines.length} total]`;
      sections[4] = candidate; // replace source code block content
      const candidateResult = sections.join("\n");
      if (estimateTokens(candidateResult) <= maxTokens) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    sourceBlock = sourceLines.slice(0, lo).join("\n")
      + `\n... [truncated — showing first ${lo} lines of ${sourceLines.length} total]`;
    sections[4] = sourceBlock;
    truncated = true;
    result = sections.join("\n");
  }

  if (truncated) {
    result += `\n<!-- truncated: true -->`;
  }

  return result;
}

/**
 * Build a syntactic repair prompt — fix syntax errors in generated code.
 */
export function buildSyntacticRepairPrompt(
  ctx: PromptContext,
  brokenCode: string,
  errors: string[],
): string {
  return [
    `## Syntactic Repair: ${ctx.targetLanguage}`,
    ``,
    `The following ${ctx.targetLanguage} code has syntax errors. Fix them while preserving the intended logic.`,
    ``,
    `### Code with Errors`,
    "```" + ctx.targetLanguage,
    brokenCode,
    "```",
    ``,
    `### Errors`,
    ...errors.map((e) => `- ${e}`),
    ``,
    `### Instructions`,
    `Fix ONLY the syntax errors. Do not change logic or structure.`,
    `Return the corrected code.`,
  ].join("\n");
}

/**
 * Build a semantic repair prompt — fix semantic issues preserving meaning.
 */
export function buildSemanticRepairPrompt(
  ctx: PromptContext,
  targetCode: string,
  issues: string[],
): string {
  return [
    `## Semantic Repair: ${ctx.sourceLanguage} → ${ctx.targetLanguage}`,
    ``,
    `The translated code has semantic issues — it may not preserve the original behavior.`,
    ``,
    `### Original Source (${ctx.sourceLanguage})`,
    "```" + ctx.sourceLanguage,
    ctx.sourceCode,
    "```",
    ``,
    `### Current Translation (${ctx.targetLanguage})`,
    "```" + ctx.targetLanguage,
    targetCode,
    "```",
    ``,
    `### Semantic Issues`,
    ...issues.map((i) => `- ${i}`),
    ``,
    `### Instructions`,
    `Fix the semantic issues to ensure the ${ctx.targetLanguage} code behaves identically to the ${ctx.sourceLanguage} source.`,
    `Return the corrected code.`,
  ].join("\n");
}

function formatScoresTable(scores: TranslationScore[]): string {
  if (scores.length === 0) return "_No constructs detected._";
  const lines = ["| Construct | Confidence | AI Assist |", "|-----------|------------|-----------|"];
  for (const s of scores) {
    lines.push(`| ${s.constructId} | ${s.finalConfidence.toFixed(2)} | ${s.needsAiAssist ? "Yes" : "No"} |`);
  }
  return lines.join("\n");
}
