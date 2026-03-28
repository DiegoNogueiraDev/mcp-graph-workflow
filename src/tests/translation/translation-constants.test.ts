import { describe, it, expect } from "vitest";
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_PAIRS,
  MVP_LANGUAGE_PAIRS,
  UCR_CONFIDENCE_THRESHOLD,
  isLanguageSupported,
  isLanguagePairSupported,
} from "../../core/utils/constants.js";

describe("Translation Constants", () => {
  it("should export SUPPORTED_LANGUAGES with 12 languages", () => {
    expect(SUPPORTED_LANGUAGES).toBeDefined();
    expect(SUPPORTED_LANGUAGES.length).toBe(12);
    expect(SUPPORTED_LANGUAGES).toContain("typescript");
    expect(SUPPORTED_LANGUAGES).toContain("python");
    expect(SUPPORTED_LANGUAGES).toContain("go");
    expect(SUPPORTED_LANGUAGES).toContain("java");
    expect(SUPPORTED_LANGUAGES).toContain("rust");
    expect(SUPPORTED_LANGUAGES).toContain("csharp");
    expect(SUPPORTED_LANGUAGES).toContain("ruby");
    expect(SUPPORTED_LANGUAGES).toContain("php");
    expect(SUPPORTED_LANGUAGES).toContain("kotlin");
    expect(SUPPORTED_LANGUAGES).toContain("swift");
    expect(SUPPORTED_LANGUAGES).toContain("cpp");
    expect(SUPPORTED_LANGUAGES).toContain("lua");
  });

  it("should export MVP_LANGUAGE_PAIRS with typescript <-> python", () => {
    expect(MVP_LANGUAGE_PAIRS).toBeDefined();
    expect(MVP_LANGUAGE_PAIRS).toContainEqual({ from: "typescript", to: "python" });
    expect(MVP_LANGUAGE_PAIRS).toContainEqual({ from: "python", to: "typescript" });
  });

  it("should export SUPPORTED_LANGUAGE_PAIRS as non-empty array", () => {
    expect(SUPPORTED_LANGUAGE_PAIRS).toBeDefined();
    expect(SUPPORTED_LANGUAGE_PAIRS.length).toBeGreaterThanOrEqual(2);
  });

  it("should export UCR_CONFIDENCE_THRESHOLD as 0.7", () => {
    expect(UCR_CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  it("isLanguageSupported should return true for typescript", () => {
    expect(isLanguageSupported("typescript")).toBe(true);
  });

  it("isLanguageSupported should return false for unknown", () => {
    expect(isLanguageSupported("brainfuck")).toBe(false);
  });

  it("isLanguagePairSupported should return true for TS->Python", () => {
    expect(isLanguagePairSupported("typescript", "python")).toBe(true);
  });

  it("isLanguagePairSupported should return false for unsupported pair", () => {
    expect(isLanguagePairSupported("typescript", "brainfuck")).toBe(false);
  });
});
