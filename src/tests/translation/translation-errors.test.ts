import { describe, it, expect } from "vitest";
import {
  McpGraphError,
  TranslationError,
  UnsupportedLanguagePairError,
  TranslationValidationError,
} from "../../core/utils/errors.js";

describe("Translation Error Types", () => {
  describe("TranslationError", () => {
    it("should extend McpGraphError", () => {
      const err = new TranslationError("something failed");
      expect(err).toBeInstanceOf(McpGraphError);
      expect(err).toBeInstanceOf(Error);
    });

    it("should have name TranslationError", () => {
      const err = new TranslationError("test");
      expect(err.name).toBe("TranslationError");
    });

    it("should format message with prefix", () => {
      const err = new TranslationError("parser crashed");
      expect(err.message).toContain("parser crashed");
    });
  });

  describe("UnsupportedLanguagePairError", () => {
    it("should extend McpGraphError", () => {
      const err = new UnsupportedLanguagePairError("typescript", "brainfuck");
      expect(err).toBeInstanceOf(McpGraphError);
    });

    it("should include from and to in message", () => {
      const err = new UnsupportedLanguagePairError("rust", "cobol");
      expect(err.message).toContain("rust");
      expect(err.message).toContain("cobol");
    });

    it("should expose from and to properties", () => {
      const err = new UnsupportedLanguagePairError("go", "lua");
      expect(err.from).toBe("go");
      expect(err.to).toBe("lua");
    });

    it("should have correct name", () => {
      const err = new UnsupportedLanguagePairError("a", "b");
      expect(err.name).toBe("UnsupportedLanguagePairError");
    });
  });

  describe("TranslationValidationError", () => {
    it("should extend McpGraphError", () => {
      const err = new TranslationValidationError("job_001", "syntax check failed");
      expect(err).toBeInstanceOf(McpGraphError);
    });

    it("should include jobId in message", () => {
      const err = new TranslationValidationError("job_xyz", "type mismatch");
      expect(err.message).toContain("job_xyz");
      expect(err.message).toContain("type mismatch");
    });

    it("should expose jobId property", () => {
      const err = new TranslationValidationError("job_123", "failed");
      expect(err.jobId).toBe("job_123");
    });

    it("should have correct name", () => {
      const err = new TranslationValidationError("j", "m");
      expect(err.name).toBe("TranslationValidationError");
    });
  });
});
