import { describe, it, expect } from "vitest";
import {
  buildMappingPrompt,
  buildTranslationPrompt,
  buildSyntacticRepairPrompt,
  buildSemanticRepairPrompt,
  type PromptContext,
} from "../../core/translation/prompt-builder.js";
import type { TranslationScore, AmbiguityReport } from "../../core/translation/ucr/construct-types.js";

function createContext(overrides?: Partial<PromptContext>): PromptContext {
  return {
    sourceLanguage: "typescript",
    targetLanguage: "python",
    sourceCode: 'function greet(name: string): void {\n  console.log(`Hello ${name}`);\n}',
    scores: [
      {
        constructId: "uc_fn_def",
        staticConfidence: 0.9,
        contextualConfidence: 1.0,
        finalConfidence: 0.93,
        selectedMappingId: "m1",
        alternatives: [],
        needsAiAssist: false,
      },
    ],
    ambiguities: [],
    ...overrides,
  };
}

describe("prompt-builder", () => {
  describe("buildMappingPrompt", () => {
    it("should generate a mapping prompt with source language and constructs", () => {
      const ctx = createContext();
      const prompt = buildMappingPrompt(ctx);

      expect(prompt).toContain("typescript");
      expect(prompt).toContain("python");
      expect(prompt).toContain("uc_fn_def");
    });

    it("should include ambiguity warnings when present", () => {
      const ambiguity: AmbiguityReport = {
        constructId: "uc_interface",
        canonicalName: "interface",
        ambiguityType: "multiple_targets",
        candidates: [
          { mappingId: "m1", confidence: 0.7, tradeoff: "TypedDict" },
          { mappingId: "m2", confidence: 0.6, tradeoff: "Protocol" },
        ],
        recommendation: "Prefer TypedDict for data-only interfaces",
      };
      const ctx = createContext({ ambiguities: [ambiguity] });
      const prompt = buildMappingPrompt(ctx);

      expect(prompt).toContain("multiple_targets");
      expect(prompt).toContain("interface");
    });

    it("should return non-empty string", () => {
      const prompt = buildMappingPrompt(createContext());
      expect(prompt.length).toBeGreaterThan(50);
    });
  });

  describe("buildTranslationPrompt", () => {
    it("should include source code and target language", () => {
      const ctx = createContext();
      const prompt = buildTranslationPrompt(ctx);

      expect(prompt).toContain("python");
      expect(prompt).toContain("function greet");
    });

    it("should include construct mapping info", () => {
      const prompt = buildTranslationPrompt(createContext());
      expect(prompt).toContain("uc_fn_def");
    });

    it("should flag constructs needing AI assist", () => {
      const scores: TranslationScore[] = [
        {
          constructId: "uc_interface",
          staticConfidence: 0.5,
          contextualConfidence: 0.6,
          finalConfidence: 0.53,
          selectedMappingId: "m2",
          alternatives: [{ mappingId: "m3", confidence: 0.4, reason: "Protocol" }],
          needsAiAssist: true,
        },
      ];
      const ctx = createContext({ scores });
      const prompt = buildTranslationPrompt(ctx);

      expect(prompt).toContain("AI");
    });
  });

  describe("buildSyntacticRepairPrompt", () => {
    it("should include the broken code and error info", () => {
      const ctx = createContext();
      const brokenCode = "def greet(name):\n  print(f'Hello {name}'";
      const errors = ["SyntaxError: unexpected EOF while parsing"];
      const prompt = buildSyntacticRepairPrompt(ctx, brokenCode, errors);

      expect(prompt).toContain("def greet");
      expect(prompt).toContain("SyntaxError");
      expect(prompt).toContain("python");
    });
  });

  describe("buildSemanticRepairPrompt", () => {
    it("should include source, target, and semantic issues", () => {
      const ctx = createContext();
      const targetCode = "def greet(name):\n    print(f'Hello {name}')";
      const issues = ["Missing return type annotation", "console.log mapped to print but should use logging"];
      const prompt = buildSemanticRepairPrompt(ctx, targetCode, issues);

      expect(prompt).toContain("def greet");
      expect(prompt).toContain("Missing return type");
      expect(prompt).toContain("typescript");
      expect(prompt).toContain("python");
    });
  });
});
