/**
 * TDD tests for rule format schema and rule loader.
 * Task 4.2a: Zod schema for rule format + rule loader.
 */
import { describe, it, expect } from "vitest";
import {
  TranslationRuleSchema,
  RuleSetSchema,
  type TranslationRule,
  type RuleSet,
  loadRuleSet,
} from "../../core/translation/rules/rule-schema.js";

describe("TranslationRuleSchema", () => {
  it("should validate a well-formed rule", () => {
    const rule: TranslationRule = {
      id: "rule_if_ts_py",
      irNodeType: "IfStatement",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      condition: {
        irNodeType: "IfStatement",
      },
      transformation: {
        template: "if {{condition}}:\n    {{body}}",
      },
      confidence: 1.0,
    };

    const result = TranslationRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
  });

  it("should reject rule without required fields", () => {
    const result = TranslationRuleSchema.safeParse({
      id: "bad",
      // missing irNodeType, sourceLanguage, targetLanguage, condition, transformation
    });

    expect(result.success).toBe(false);
  });

  it("should reject rule with invalid confidence", () => {
    const result = TranslationRuleSchema.safeParse({
      id: "bad",
      irNodeType: "IfStatement",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      condition: { irNodeType: "IfStatement" },
      transformation: { template: "if:" },
      confidence: 1.5, // > 1.0
    });

    expect(result.success).toBe(false);
  });

  it("should accept optional condition properties", () => {
    const rule: TranslationRule = {
      id: "rule_async_fn",
      irNodeType: "AsyncFunction",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      condition: {
        irNodeType: "AsyncFunction",
        hasChildren: true,
      },
      transformation: {
        template: "async def {{name}}({{params}}):\n    {{body}}",
      },
      confidence: 0.95,
    };

    const result = TranslationRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
  });
});

describe("RuleSetSchema", () => {
  it("should validate a well-formed rule set", () => {
    const ruleSet: RuleSet = {
      id: "ts-to-python",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      version: "1.0.0",
      rules: [
        {
          id: "rule_if",
          irNodeType: "IfStatement",
          sourceLanguage: "typescript",
          targetLanguage: "python",
          condition: { irNodeType: "IfStatement" },
          transformation: { template: "if {{condition}}:" },
          confidence: 1.0,
        },
      ],
    };

    const result = RuleSetSchema.safeParse(ruleSet);
    expect(result.success).toBe(true);
  });

  it("should reject rule set with empty rules array", () => {
    const result = RuleSetSchema.safeParse({
      id: "empty",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      version: "1.0.0",
      rules: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("loadRuleSet", () => {
  it("should load and validate a rule set from object", () => {
    const raw = {
      id: "ts-to-python",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      version: "1.0.0",
      rules: [
        {
          id: "rule_fn",
          irNodeType: "FunctionDecl",
          sourceLanguage: "typescript",
          targetLanguage: "python",
          condition: { irNodeType: "FunctionDecl" },
          transformation: { template: "def {{name}}({{params}}):\n    {{body}}" },
          confidence: 1.0,
        },
      ],
    };

    const result = loadRuleSet(raw);
    expect(result.id).toBe("ts-to-python");
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].irNodeType).toBe("FunctionDecl");
  });

  it("should throw on malformed rule set", () => {
    expect(() => loadRuleSet({ bad: "data" })).toThrow();
  });
});
