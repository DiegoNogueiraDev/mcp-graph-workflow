/**
 * TDD Red: Tests for treesitter/reference-content.ts — deterministic language rules.
 * Validates that LANGUAGE_REFERENCES covers all 12 languages (c and cpp separate)
 * with correct structure and rule-based patterns.
 */

import { describe, it, expect } from "vitest";
import {
  LANGUAGE_REFERENCES,
  SUPPORTED_LANGUAGES,
} from "../core/code/treesitter/reference-content.js";

const EXPECTED_LANGUAGES = [
  "python", "go", "rust", "java", "c", "cpp",
  "ruby", "php", "kotlin", "swift", "csharp", "lua",
] as const;

describe("treesitter/reference-content — LANGUAGE_REFERENCES", () => {
  it("should export SUPPORTED_LANGUAGES with all 12 language IDs", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(12);
    for (const lang of EXPECTED_LANGUAGES) {
      expect(SUPPORTED_LANGUAGES).toContain(lang);
    }
  });

  it("should export LANGUAGE_REFERENCES with entries for all supported languages", () => {
    for (const lang of EXPECTED_LANGUAGES) {
      expect(LANGUAGE_REFERENCES[lang]).toBeDefined();
    }
  });

  describe("each language reference has required fields", () => {
    for (const lang of EXPECTED_LANGUAGES) {
      describe(lang, () => {
        it("should have languageId matching the key", () => {
          const ref = LANGUAGE_REFERENCES[lang];
          expect(ref.languageId).toBe(lang);
        });

        it("should have non-empty extensions starting with dot", () => {
          const ref = LANGUAGE_REFERENCES[lang];
          expect(ref.extensions.length).toBeGreaterThan(0);
          for (const ext of ref.extensions) {
            expect(ext).toMatch(/^\./);
          }
        });

        it("should have non-empty testPatterns as RegExp[]", () => {
          const ref = LANGUAGE_REFERENCES[lang];
          expect(ref.testPatterns.length).toBeGreaterThan(0);
          for (const pattern of ref.testPatterns) {
            expect(pattern).toBeInstanceOf(RegExp);
          }
        });

        it("should have ignoredDirs as array", () => {
          const ref = LANGUAGE_REFERENCES[lang];
          expect(Array.isArray(ref.ignoredDirs)).toBe(true);
        });

        it("should have docstringPattern with commentRegex", () => {
          const ref = LANGUAGE_REFERENCES[lang];
          expect(ref.docstringPattern).toBeDefined();
          expect(ref.docstringPattern.commentRegex).toBeInstanceOf(RegExp);
        });

        it("should have visibilityRules with defaultVisibility", () => {
          const ref = LANGUAGE_REFERENCES[lang];
          expect(ref.visibilityRules).toBeDefined();
          expect(["public", "private", "internal", "package"]).toContain(ref.visibilityRules.defaultVisibility);
        });

        it("should have non-empty importNodeTypes", () => {
          const ref = LANGUAGE_REFERENCES[lang];
          expect(ref.importNodeTypes.length).toBeGreaterThan(0);
        });
      });
    }
  });

  describe("specific language rules", () => {
    it("Python: underscore prefix export detection", () => {
      const py = LANGUAGE_REFERENCES.python;
      expect(py.visibilityRules.defaultVisibility).toBe("public");
      expect(py.visibilityRules.exportDetection).toBe("underscore_prefix");
    });

    it("Go: uppercase first letter export detection", () => {
      const go = LANGUAGE_REFERENCES.go;
      expect(go.visibilityRules.defaultVisibility).toBe("package");
      expect(go.visibilityRules.exportDetection).toBe("uppercase_first");
    });

    it("Rust: pub keyword, default private", () => {
      const rust = LANGUAGE_REFERENCES.rust;
      expect(rust.visibilityRules.defaultVisibility).toBe("private");
      expect(rust.visibilityRules.exportDetection).toBe("pub_keyword");
    });

    it("Java: modifier keyword, default package-private", () => {
      const java = LANGUAGE_REFERENCES.java;
      expect(java.visibilityRules.defaultVisibility).toBe("package");
      expect(java.visibilityRules.exportDetection).toBe("modifier_keyword");
    });

    it("Go test pattern matches _test.go only", () => {
      const go = LANGUAGE_REFERENCES.go;
      expect(go.testPatterns.some((p) => p.test("handler_test.go"))).toBe(true);
      expect(go.testPatterns.some((p) => p.test("handler.go"))).toBe(false);
    });

    it("Python test pattern matches test_*.py and *_test.py", () => {
      const py = LANGUAGE_REFERENCES.python;
      expect(py.testPatterns.some((p) => p.test("test_handler.py"))).toBe(true);
      expect(py.testPatterns.some((p) => p.test("handler_test.py"))).toBe(true);
      expect(py.testPatterns.some((p) => p.test("handler.py"))).toBe(false);
    });

    it("Rust docstring regex matches ///", () => {
      const rust = LANGUAGE_REFERENCES.rust;
      expect(rust.docstringPattern.commentRegex.test("/// This is a doc")).toBe(true);
    });

    it("Java docstring regex matches /**", () => {
      const java = LANGUAGE_REFERENCES.java;
      expect(java.docstringPattern.commentRegex.test("/** Javadoc */")).toBe(true);
    });

    it("C# docstring regex matches ///", () => {
      const cs = LANGUAGE_REFERENCES.csharp;
      expect(cs.docstringPattern.commentRegex.test("/// <summary>")).toBe(true);
    });

    it("Lua docstring regex matches ---", () => {
      const lua = LANGUAGE_REFERENCES.lua;
      expect(lua.docstringPattern.commentRegex.test("--- @param x number")).toBe(true);
    });
  });
});
