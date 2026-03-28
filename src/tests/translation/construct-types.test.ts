import { describe, it, expect } from "vitest";
import {
  UcrCategorySchema,
  UcrConstructSchema,
  UcrLanguageMappingSchema,
  UcrEquivalenceClassSchema,
  CanonicalConstructSchema,
  TranslationPathSchema,
  TranslationScoreSchema,
  AmbiguityReportSchema,
  UcrSeedDataSchema,
} from "../../core/translation/ucr/construct-types.js";

describe("UCR Construct Types", () => {
  describe("UcrCategorySchema", () => {
    it("should validate category with id and name", () => {
      const result = UcrCategorySchema.safeParse({
        id: "control_flow",
        name: "Control Flow",
        description: "Conditional and loop constructs",
      });
      expect(result.success).toBe(true);
    });

    it("should reject category without id", () => {
      const result = UcrCategorySchema.safeParse({
        name: "Control Flow",
      });
      expect(result.success).toBe(false);
    });

    it("should accept category without description", () => {
      const result = UcrCategorySchema.safeParse({
        id: "functions",
        name: "Functions",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("UcrConstructSchema", () => {
    it("should validate canonical construct with all fields", () => {
      const result = UcrConstructSchema.safeParse({
        id: "uc_fn_def",
        categoryId: "functions",
        canonicalName: "function_definition",
        description: "A function or method definition",
        semanticGroup: "callable",
        metadata: { hasParams: true, hasReturn: true },
      });
      expect(result.success).toBe(true);
    });

    it("should accept construct without optional fields", () => {
      const result = UcrConstructSchema.safeParse({
        id: "uc_if_else",
        categoryId: "control_flow",
        canonicalName: "if_else",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("UcrLanguageMappingSchema", () => {
    it("should validate mapping with confidence between 0 and 1", () => {
      const result = UcrLanguageMappingSchema.safeParse({
        id: "map_fn_def_ts",
        constructId: "uc_fn_def",
        languageId: "typescript",
        syntaxPattern: "function {{name}}({{params}}): {{returnType}} { {{body}} }",
        astNodeType: "function_declaration",
        confidence: 1.0,
        isPrimary: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject confidence greater than 1", () => {
      const result = UcrLanguageMappingSchema.safeParse({
        id: "map_test",
        constructId: "uc_fn_def",
        languageId: "python",
        syntaxPattern: "def {{name}}({{params}}):",
        confidence: 1.5,
        isPrimary: true,
      });
      expect(result.success).toBe(false);
    });

    it("should reject confidence less than 0", () => {
      const result = UcrLanguageMappingSchema.safeParse({
        id: "map_test",
        constructId: "uc_fn_def",
        languageId: "python",
        syntaxPattern: "def {{name}}({{params}}):",
        confidence: -0.1,
        isPrimary: true,
      });
      expect(result.success).toBe(false);
    });

    it("should accept mapping with constraints JSON", () => {
      const result = UcrLanguageMappingSchema.safeParse({
        id: "map_interface_py_td",
        constructId: "uc_interface",
        languageId: "python",
        syntaxPattern: "class {{name}}(TypedDict):",
        confidence: 0.8,
        isPrimary: true,
        constraints: { onlyFields: true, noMethods: true },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("CanonicalConstructSchema", () => {
    it("should support recursive children (nested constructs)", () => {
      const result = CanonicalConstructSchema.safeParse({
        constructId: "uc_fn_def",
        canonicalName: "function_definition",
        sourceText: "function sum(a, b) { return a + b; }",
        startLine: 1,
        endLine: 3,
        children: [
          {
            constructId: "uc_return",
            canonicalName: "return_statement",
            sourceText: "return a + b",
            startLine: 2,
            endLine: 2,
            children: [],
          },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.children).toHaveLength(1);
        expect(result.data.children[0].canonicalName).toBe("return_statement");
      }
    });

    it("should validate construct without children (leaf)", () => {
      const result = CanonicalConstructSchema.safeParse({
        constructId: "uc_if_else",
        canonicalName: "if_else",
        sourceText: "if (x > 0) {}",
        startLine: 5,
        endLine: 5,
        children: [],
      });
      expect(result.success).toBe(true);
    });

    it("should validate construct with metadata", () => {
      const result = CanonicalConstructSchema.safeParse({
        constructId: "uc_fn_def",
        canonicalName: "function_definition",
        sourceText: "async function fetchData(): Promise<void> {}",
        startLine: 1,
        endLine: 1,
        children: [],
        metadata: { async: true, name: "fetchData", returnType: "Promise<void>" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("UcrEquivalenceClassSchema", () => {
    it("should validate with equivalenceType exact", () => {
      const result = UcrEquivalenceClassSchema.safeParse({
        id: "eq_conditional",
        name: "conditional_branching",
        equivalenceType: "exact",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid equivalenceType", () => {
      const result = UcrEquivalenceClassSchema.safeParse({
        id: "eq_test",
        name: "test",
        equivalenceType: "unknown_type",
      });
      expect(result.success).toBe(false);
    });

    it("should accept all valid equivalence types", () => {
      for (const eqType of ["exact", "syntactic", "semantic", "none"]) {
        const result = UcrEquivalenceClassSchema.safeParse({
          id: `eq_${eqType}`,
          name: `test_${eqType}`,
          equivalenceType: eqType,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("TranslationPathSchema", () => {
    it("should validate path with sourceMapping + targetMapping + confidence", () => {
      const result = TranslationPathSchema.safeParse({
        sourceMapping: {
          id: "map_fn_ts",
          constructId: "uc_fn_def",
          languageId: "typescript",
          syntaxPattern: "function {{name}}() {}",
          confidence: 1.0,
          isPrimary: true,
        },
        targetMapping: {
          id: "map_fn_py",
          constructId: "uc_fn_def",
          languageId: "python",
          syntaxPattern: "def {{name}}():",
          confidence: 1.0,
          isPrimary: true,
        },
        confidence: 1.0,
        alternatives: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("TranslationScoreSchema", () => {
    it("should validate score with needsAiAssist based on confidence", () => {
      const result = TranslationScoreSchema.safeParse({
        constructId: "uc_interface",
        staticConfidence: 0.8,
        contextualConfidence: 0.5,
        finalConfidence: 0.65,
        selectedMappingId: "map_interface_py_td",
        alternatives: [
          { mappingId: "map_interface_py_proto", confidence: 0.6, reason: "has methods" },
        ],
        needsAiAssist: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AmbiguityReportSchema", () => {
    it("should validate report with ambiguityType multiple_targets", () => {
      const result = AmbiguityReportSchema.safeParse({
        constructId: "uc_interface",
        canonicalName: "interface_definition",
        ambiguityType: "multiple_targets",
        candidates: [
          { mappingId: "map_py_td", confidence: 0.8, tradeoff: "No runtime validation" },
          { mappingId: "map_py_dc", confidence: 0.6, tradeoff: "Adds dataclass dependency" },
        ],
        recommendation: "TypedDict for data-only interfaces",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid ambiguityType", () => {
      const result = AmbiguityReportSchema.safeParse({
        constructId: "uc_test",
        canonicalName: "test",
        ambiguityType: "invalid_type",
        candidates: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("UcrSeedDataSchema", () => {
    it("should validate complete seed data with categories + constructs + mappings", () => {
      const result = UcrSeedDataSchema.safeParse({
        categories: [
          { id: "control_flow", name: "Control Flow" },
        ],
        constructs: [
          { id: "uc_if_else", categoryId: "control_flow", canonicalName: "if_else" },
        ],
        mappings: [
          {
            id: "map_if_ts",
            constructId: "uc_if_else",
            languageId: "typescript",
            syntaxPattern: "if ({{condition}}) { {{body}} }",
            confidence: 1.0,
            isPrimary: true,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should reject seed data without categories", () => {
      const result = UcrSeedDataSchema.safeParse({
        constructs: [],
        mappings: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
