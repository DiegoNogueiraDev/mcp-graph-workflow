/**
 * Rule Schema — Zod schemas for declarative translation rules.
 *
 * Each rule maps an IR node type (condition) to a target syntax template (transformation).
 * Rules are organized in rule sets per language pair (e.g., ts-to-python.json).
 */

import { z } from "zod/v4";

// ── Rule Condition ─────────────────────────────────

const RuleConditionSchema = z.object({
  /** IR node type to match. */
  irNodeType: z.string(),
  /** Optional: require the node to have children. */
  hasChildren: z.boolean().optional(),
  /** Optional: match by construct metadata key/value. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Rule Transformation ────────────────────────────

const RuleTransformationSchema = z.object({
  /** Target syntax template with {{placeholders}}. */
  template: z.string().min(1),
  /** Optional: notes about the transformation for humans. */
  notes: z.string().optional(),
});

// ── Translation Rule ───────────────────────────────

export const TranslationRuleSchema = z.object({
  /** Unique rule ID. */
  id: z.string().min(1),
  /** IR node type this rule applies to. */
  irNodeType: z.string().min(1),
  /** Source language (e.g., "typescript"). */
  sourceLanguage: z.string().min(1),
  /** Target language (e.g., "python"). */
  targetLanguage: z.string().min(1),
  /** Condition to match IR nodes. */
  condition: RuleConditionSchema,
  /** Transformation template for target language. */
  transformation: RuleTransformationSchema,
  /** Confidence of this rule (0-1). */
  confidence: z.number().min(0).max(1),
});

export type TranslationRule = z.infer<typeof TranslationRuleSchema>;

// ── Rule Set ───────────────────────────────────────

export const RuleSetSchema = z.object({
  /** Rule set ID (e.g., "ts-to-python"). */
  id: z.string().min(1),
  /** Source language for all rules in this set. */
  sourceLanguage: z.string().min(1),
  /** Target language for all rules in this set. */
  targetLanguage: z.string().min(1),
  /** Semantic version of this rule set. */
  version: z.string().min(1),
  /** Rules in this set (at least 1). */
  rules: z.array(TranslationRuleSchema).min(1),
});

export type RuleSet = z.infer<typeof RuleSetSchema>;

// ── Loader ─────────────────────────────────────────

/**
 * Load and validate a rule set from a raw object (e.g., parsed JSON).
 * Throws on validation failure.
 */
export function loadRuleSet(raw: unknown): RuleSet {
  return RuleSetSchema.parse(raw);
}
