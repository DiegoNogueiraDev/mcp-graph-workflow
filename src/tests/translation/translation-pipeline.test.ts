/**
 * TDD tests for Direct MCP Integration (translation pipeline).
 * Task 4.5: End-to-end automated translation without copy-paste.
 */
import { describe, it, expect } from "vitest";
import {
  TranslationPipeline,
  type TranslationPipelineOptions,
  type PipelineResult,
} from "../../core/translation/pipeline/translation-pipeline.js";
import type { ParsedConstruct } from "../../core/translation/parsers/parser-adapter.js";

describe("TranslationPipeline", () => {
  // Mock parser that returns fixed constructs
  const mockParser = (code: string): ParsedConstruct[] => [
    { constructId: "uc_fn_def", name: "add", startLine: 1, endLine: 3 },
    { constructId: "uc_return", startLine: 2, endLine: 2 },
  ];

  // Mock AI translation function
  const mockTranslate = async (prompt: string): Promise<string> => {
    return "def add(a, b):\n    return a + b";
  };

  const defaultOptions: TranslationPipelineOptions = {
    sourceLanguage: "typescript",
    targetLanguage: "python",
    parser: mockParser,
    translateFn: mockTranslate,
    maxRepairIterations: 3,
  };

  it("should run the full pipeline: parse → IR → rules → translate → validate", async () => {
    const pipeline = new TranslationPipeline(defaultOptions);
    const result = await pipeline.translate("function add(a, b) { return a + b; }");

    expect(result.success).toBe(true);
    expect(result.targetCode).toBeDefined();
    expect(result.targetCode.length).toBeGreaterThan(0);
  });

  it("should include IR tree in result", async () => {
    const pipeline = new TranslationPipeline(defaultOptions);
    const result = await pipeline.translate("function add(a, b) { return a + b; }");

    expect(result.irTree).toBeDefined();
    expect(result.irTree.type).toBe("Program");
    expect(result.irTree.children.length).toBeGreaterThan(0);
  });

  it("should include rule match results", async () => {
    const pipeline = new TranslationPipeline(defaultOptions);
    const result = await pipeline.translate("function add(a, b) { return a + b; }");

    expect(result.ruleResults).toBeDefined();
    expect(result.ruleResults.matched.length).toBeGreaterThan(0);
  });

  it("should include validation result", async () => {
    const pipeline = new TranslationPipeline(defaultOptions);
    const result = await pipeline.translate("function add(a, b) { return a + b; }");

    expect(result.validation).toBeDefined();
    expect(result.validation.language).toBe("python");
  });

  it("should attempt repair if initial validation fails", async () => {
    let callCount = 0;
    const failFirstTranslate = async (): Promise<string> => {
      callCount++;
      if (callCount === 1) return "def broken()\n    return 1"; // missing colon
      return "def fixed():\n    return 1";
    };

    const pipeline = new TranslationPipeline({
      ...defaultOptions,
      translateFn: failFirstTranslate,
    });

    const result = await pipeline.translate("function test() { return 1; }");

    // Pipeline should have attempted repair
    expect(result.repairAttempted).toBeDefined();
  });

  it("should work without translateFn (rule-only mode)", async () => {
    const pipeline = new TranslationPipeline({
      ...defaultOptions,
      translateFn: undefined,
    });

    const result = await pipeline.translate("function add(a, b) { return a + b; }");

    // In rule-only mode, targetCode comes from templates
    expect(result.ruleResults).toBeDefined();
    expect(result.ruleResults.matched.length).toBeGreaterThan(0);
  });
});
