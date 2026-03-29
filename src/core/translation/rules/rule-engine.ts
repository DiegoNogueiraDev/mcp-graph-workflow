/**
 * Rule Engine — matches IR nodes against translation rules and applies transformations.
 *
 * Given a RuleSet and IR nodes, finds the best matching rule for each node.
 * Unmatched nodes are flagged for AI fallback.
 */

import type { RuleSet, TranslationRule } from "./rule-schema.js";
import type { IRNode } from "../ir/ir-types.js";

// ── Match Result ───────────────────────────────────

export interface RuleMatchResult {
  node: IRNode;
  rule: TranslationRule;
  confidence: number;
}

export interface ApplyRulesResult {
  matched: RuleMatchResult[];
  unmatched: IRNode[];
}

// ── Rule Engine ────────────────────────────────────

export class RuleEngine {
  private rulesByType: Map<string, TranslationRule[]> = new Map();

  constructor(ruleSet: RuleSet) {
    // Index rules by irNodeType for O(1) lookup
    for (const rule of ruleSet.rules) {
      const existing = this.rulesByType.get(rule.irNodeType) ?? [];
      existing.push(rule);
      this.rulesByType.set(rule.irNodeType, existing);
    }
  }

  /** Number of rules loaded. */
  get ruleCount(): number {
    let count = 0;
    for (const rules of this.rulesByType.values()) {
      count += rules.length;
    }
    return count;
  }

  /**
   * Find the best matching rule for an IR node.
   * Returns undefined if no rule matches (node should go to AI fallback).
   */
  matchRule(node: IRNode): RuleMatchResult | undefined {
    const candidates = this.rulesByType.get(node.type);
    if (!candidates || candidates.length === 0) {
      return undefined;
    }

    // Find best match by condition + highest confidence
    let bestRule: TranslationRule | undefined;
    let bestConfidence = -1;

    for (const rule of candidates) {
      if (!this.matchesCondition(node, rule)) continue;

      if (rule.confidence > bestConfidence) {
        bestConfidence = rule.confidence;
        bestRule = rule;
      }
    }

    if (!bestRule) return undefined;

    return {
      node,
      rule: bestRule,
      confidence: bestConfidence,
    };
  }

  /**
   * Apply rules to a list of IR nodes.
   * Returns matched nodes (with their rules) and unmatched nodes (for AI fallback).
   */
  applyRules(nodes: IRNode[]): ApplyRulesResult {
    const matched: RuleMatchResult[] = [];
    const unmatched: IRNode[] = [];

    for (const node of nodes) {
      const result = this.matchRule(node);
      if (result) {
        matched.push(result);
      } else {
        unmatched.push(node);
      }
    }

    return { matched, unmatched };
  }

  /**
   * Check if an IR node matches a rule's condition.
   */
  private matchesCondition(node: IRNode, rule: TranslationRule): boolean {
    // Type must match
    if (rule.condition.irNodeType !== node.type) return false;

    // Optional: check hasChildren
    if (rule.condition.hasChildren !== undefined) {
      const hasChildren = node.children.length > 0;
      if (rule.condition.hasChildren !== hasChildren) return false;
    }

    // Optional: check metadata
    if (rule.condition.metadata) {
      for (const [key, value] of Object.entries(rule.condition.metadata)) {
        if (node.metadata?.[key] !== value) return false;
      }
    }

    return true;
  }
}
