import { describe, it, expect } from "vitest";
import {
  TranslationJobStatusSchema,
  TranslationScopeSchema,
  TranslationJobSchema,
  TranslationAnalysisSchema,
  TranslationResultSchema,
  EvidencePackSchema,
  TranslationMetricsSchema,
} from "../../core/translation/translation-types.js";

describe("Translation Types", () => {
  describe("TranslationJobStatusSchema", () => {
    it("should accept all valid statuses", () => {
      for (const status of ["pending", "analyzing", "translating", "validating", "done", "failed"]) {
        const result = TranslationJobStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid status", () => {
      const result = TranslationJobStatusSchema.safeParse("unknown");
      expect(result.success).toBe(false);
    });
  });

  describe("TranslationScopeSchema", () => {
    it("should accept all valid scopes", () => {
      for (const scope of ["snippet", "function", "module"]) {
        const result = TranslationScopeSchema.safeParse(scope);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("TranslationJobSchema", () => {
    it("should validate a complete job", () => {
      const result = TranslationJobSchema.safeParse({
        id: "job_001",
        projectId: "proj_abc",
        sourceLanguage: "typescript",
        targetLanguage: "python",
        sourceCode: "function sum(a: number, b: number): number { return a + b; }",
        status: "pending",
        scope: "snippet",
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("should accept job with optional targetCode", () => {
      const result = TranslationJobSchema.safeParse({
        id: "job_002",
        projectId: "proj_abc",
        sourceLanguage: "python",
        targetLanguage: "typescript",
        sourceCode: "def sum(a, b):\n    return a + b",
        targetCode: "function sum(a: number, b: number): number { return a + b; }",
        status: "done",
        scope: "function",
        confidenceScore: 0.92,
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("should reject job without sourceCode", () => {
      const result = TranslationJobSchema.safeParse({
        id: "job_003",
        projectId: "proj_abc",
        sourceLanguage: "typescript",
        targetLanguage: "python",
        status: "pending",
        scope: "snippet",
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("should accept job with constraints", () => {
      const result = TranslationJobSchema.safeParse({
        id: "job_004",
        projectId: "proj_abc",
        sourceLanguage: "typescript",
        targetLanguage: "python",
        sourceCode: "const x = 1;",
        status: "pending",
        scope: "snippet",
        constraints: { preserveBehavior: true, preferIdiomaticTarget: true },
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("TranslationAnalysisSchema", () => {
    it("should validate analysis with constructs and complexity", () => {
      const result = TranslationAnalysisSchema.safeParse({
        detectedLanguage: "typescript",
        detectedConfidence: 0.95,
        constructs: [
          { canonicalName: "function_definition", count: 3, confidence: 1.0 },
          { canonicalName: "if_else", count: 2, confidence: 1.0 },
          { canonicalName: "interface_definition", count: 1, confidence: 0.7 },
        ],
        complexityScore: 0.45,
        estimatedTranslatability: 0.85,
        ambiguousConstructs: ["interface_definition"],
        totalConstructs: 6,
      });
      expect(result.success).toBe(true);
    });

    it("should reject analysis without detectedLanguage", () => {
      const result = TranslationAnalysisSchema.safeParse({
        constructs: [],
        complexityScore: 0.1,
        estimatedTranslatability: 0.9,
        totalConstructs: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("TranslationResultSchema", () => {
    it("should validate result with target code and mappings", () => {
      const result = TranslationResultSchema.safeParse({
        targetCode: "def sum(a, b):\n    return a + b",
        mappingReport: [
          {
            sourceConstruct: "function_definition",
            targetConstruct: "function_definition",
            method: "rule",
            confidence: 1.0,
          },
        ],
        warnings: ["TypedDict chosen over dataclass"],
        confidenceScore: 0.86,
        repairIterations: 0,
        metrics: {
          parseSuccess: true,
          lintSuccess: true,
          typeCheckSuccess: true,
          ruleCoverage: 0.78,
          templateCoverage: 0.14,
          llmInterventions: 1,
          tokensConsumed: 0,
          totalTimeMs: 230,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("EvidencePackSchema", () => {
    it("should validate evidence pack with all sections", () => {
      const result = EvidencePackSchema.safeParse({
        diff: "- function sum(a, b) { return a + b; }\n+ def sum(a, b):\n+     return a + b",
        translatedConstructs: [
          { source: "function", target: "def", method: "rule" },
        ],
        risks: [
          { construct: "interface User", severity: "medium", message: "Multiple valid targets in Python" },
        ],
        confidenceScore: 0.86,
        humanReviewPoints: ["Verify TypedDict is the correct mapping for User interface"],
      });
      expect(result.success).toBe(true);
    });

    it("should accept evidence pack with empty risks", () => {
      const result = EvidencePackSchema.safeParse({
        diff: "",
        translatedConstructs: [],
        risks: [],
        confidenceScore: 1.0,
        humanReviewPoints: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("TranslationMetricsSchema", () => {
    it("should validate metrics with all fields", () => {
      const result = TranslationMetricsSchema.safeParse({
        parseSuccess: true,
        lintSuccess: true,
        typeCheckSuccess: false,
        ruleCoverage: 0.72,
        templateCoverage: 0.18,
        llmInterventions: 2,
        tokensConsumed: 1500,
        totalTimeMs: 3200,
      });
      expect(result.success).toBe(true);
    });

    it("should reject ruleCoverage > 1", () => {
      const result = TranslationMetricsSchema.safeParse({
        parseSuccess: true,
        lintSuccess: true,
        typeCheckSuccess: true,
        ruleCoverage: 1.5,
        templateCoverage: 0.1,
        llmInterventions: 0,
        tokensConsumed: 0,
        totalTimeMs: 100,
      });
      expect(result.success).toBe(false);
    });
  });
});
