import { describe, it, expect } from "vitest";
import { readDocxContent, isDocxSupported } from "../../core/parser/read-docx.js";

describe("read-docx", () => {
  describe("isDocxSupported", () => {
    it("should return true for .docx extension", () => {
      expect(isDocxSupported(".docx")).toBe(true);
    });

    it("should return true for .doc extension", () => {
      expect(isDocxSupported(".doc")).toBe(true);
    });

    it("should return false for .pdf extension", () => {
      expect(isDocxSupported(".pdf")).toBe(false);
    });

    it("should return false for .txt extension", () => {
      expect(isDocxSupported(".txt")).toBe(false);
    });
  });

  describe("readDocxContent", () => {
    it("should throw FileNotFoundError for non-existent file", async () => {
      await expect(readDocxContent("/nonexistent/file.docx")).rejects.toThrow();
    });

    // Integration test with real .docx would require a fixture file.
    // We test the module's error handling and edge cases.
    it("should throw on empty buffer", async () => {
      // mammoth will throw on invalid/empty buffer
      await expect(readDocxContent("/dev/null")).rejects.toThrow();
    });
  });
});
