/**
 * Translation Pipeline — end-to-end automated translation.
 *
 * Pipeline: parse → IR → rules → (optional AI) → validate → (optional repair) → result.
 * Supports rule-only mode (no AI) and full AI-assisted mode.
 */

import type { ParsedConstruct } from "../parsers/parser-adapter.js";
import { convertToIR, } from "../ir/ir-converter.js";
import type { IRNode } from "../ir/ir-types.js";
import { RuleEngine, type ApplyRulesResult } from "../rules/rule-engine.js";
import { TS_TO_PYTHON_RULES } from "../rules/ts-to-python-rules.js";
import { PYTHON_TO_TS_RULES } from "../rules/python-to-ts-rules.js";
import { validateTypescript, validatePython, type ValidationResult } from "../validators/code-validator.js";
import { RepairLoop } from "../repair/repair-loop.js";
import type { ValidationError } from "../validators/code-validator.js";

// ── Types ──────────────────────────────────────────

export type ParserFunction = (code: string) => ParsedConstruct[];
export type TranslateFn = (prompt: string) => Promise<string>;

export interface TranslationPipelineOptions {
  sourceLanguage: string;
  targetLanguage: string;
  parser: ParserFunction;
  translateFn?: TranslateFn;
  maxRepairIterations?: number;
}

export interface PipelineResult {
  success: boolean;
  targetCode: string;
  irTree: IRNode;
  ruleResults: ApplyRulesResult;
  validation: ValidationResult;
  repairAttempted: boolean;
  repairIterations: number;
}

// ── Pipeline ───────────────────────────────────────

export class TranslationPipeline {
  private sourceLanguage: string;
  private targetLanguage: string;
  private parser: ParserFunction;
  private translateFn?: TranslateFn;
  private maxRepairIterations: number;

  constructor(options: TranslationPipelineOptions) {
    this.sourceLanguage = options.sourceLanguage;
    this.targetLanguage = options.targetLanguage;
    this.parser = options.parser;
    this.translateFn = options.translateFn;
    this.maxRepairIterations = options.maxRepairIterations ?? 3;
  }

  async translate(sourceCode: string): Promise<PipelineResult> {
    // Step 1: Parse source code into constructs
    const constructs = this.parser(sourceCode);

    // Step 2: Convert to IR tree
    const irTree = convertToIR(constructs);

    // Step 3: Match rules
    const ruleEngine = this.getRuleEngine();
    const ruleResults = ruleEngine.applyRules(irTree.children);

    // Step 4: Generate target code
    let targetCode: string;
    if (this.translateFn) {
      // AI-assisted: build prompt from IR + rules and call AI
      const prompt = this.buildPrompt(sourceCode, ruleResults);
      targetCode = await this.translateFn(prompt);
    } else {
      // Rule-only: combine matched rule templates
      targetCode = ruleResults.matched
        .map((m) => m.rule.transformation.template)
        .join("\n\n");
    }

    // Step 5: Validate target code
    const validator = this.getValidator();
    let validation = validator(targetCode);

    // Step 6: Repair if needed
    let repairAttempted = false;
    let repairIterations = 0;

    if (!validation.valid && this.translateFn) {
      repairAttempted = true;
      const repairLoop = new RepairLoop({
        maxIterations: this.maxRepairIterations,
        repairFn: async (code: string, errors: ValidationError[]) => {
          const repairPrompt = this.buildRepairPrompt(code, errors);
          return this.translateFn!(repairPrompt);
        },
        validator,
      });

      const repairResult = await repairLoop.repair(targetCode);
      targetCode = repairResult.finalCode;
      repairIterations = repairResult.iterations;
      validation = validator(targetCode);
    }

    return {
      success: validation.valid,
      targetCode,
      irTree,
      ruleResults,
      validation,
      repairAttempted,
      repairIterations,
    };
  }

  private getRuleEngine(): RuleEngine {
    if (this.sourceLanguage === "typescript" && this.targetLanguage === "python") {
      return new RuleEngine(TS_TO_PYTHON_RULES);
    }
    if (this.sourceLanguage === "python" && this.targetLanguage === "typescript") {
      return new RuleEngine(PYTHON_TO_TS_RULES);
    }
    // Fallback: use ts-to-python rules (default)
    return new RuleEngine(TS_TO_PYTHON_RULES);
  }

  private getValidator(): (code: string) => ValidationResult {
    if (this.targetLanguage === "python") return validatePython;
    return validateTypescript;
  }

  private buildPrompt(sourceCode: string, ruleResults: ApplyRulesResult): string {
    const matchedTemplates = ruleResults.matched
      .map((m) => `${m.node.type}: ${m.rule.transformation.template}`)
      .join("\n");

    const unmatchedTypes = ruleResults.unmatched
      .map((n) => n.type)
      .join(", ");

    return [
      `Translate the following ${this.sourceLanguage} code to ${this.targetLanguage}:`,
      "",
      sourceCode,
      "",
      "Use these patterns for matched constructs:",
      matchedTemplates,
      unmatchedTypes ? `\nThese constructs need your judgment: ${unmatchedTypes}` : "",
    ].join("\n");
  }

  private buildRepairPrompt(code: string, errors: ValidationError[]): string {
    const errorList = errors
      .map((e) => `Line ${e.line}: ${e.message}`)
      .join("\n");

    return [
      `Fix the following ${this.targetLanguage} code that has validation errors:`,
      "",
      code,
      "",
      "Errors:",
      errorList,
      "",
      "Return only the fixed code.",
    ].join("\n");
  }
}
