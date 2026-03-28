/**
 * Bug Verification — Security (Path Traversal & Memory Validation)
 * Verifies fixes for: #003, #004, #081
 *
 * Tests that path traversal attacks are blocked and memory names are validated.
 */
import { describe, it, expect } from "vitest";
import { readPrdFile } from "../core/parser/read-file.js";
import { z } from "zod/v4";

// ── Memory name regex (from src/mcp/tools/memory.ts) ──
// Reproduced here to test the validation pattern
const memoryNameSchema = z.string().min(1).regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_/.-]*$/);

describe("Bug Verification — Security", () => {
  // ── #003: Path traversal in memory tools ──
  // The actual safePath() is a private function in memory-reader.ts.
  // We test the Zod schema that protects at the MCP tool layer.

  describe("Memory name validation (#003, #081)", () => {
    it("should reject path traversal sequences in name", () => {
      expect(() => memoryNameSchema.parse("../../etc/passwd")).toThrow();
    });

    it("should reject names starting with dot-dot", () => {
      expect(() => memoryNameSchema.parse("../traversal")).toThrow();
    });

    it("should reject empty name (#040)", () => {
      expect(() => memoryNameSchema.parse("")).toThrow();
    });

    it("should reject special characters !@#$% (#081)", () => {
      expect(() => memoryNameSchema.parse("!@#$%test")).toThrow();
    });

    it("should reject names with spaces", () => {
      expect(() => memoryNameSchema.parse("has space")).toThrow();
    });

    it("should accept valid kebab-case names", () => {
      expect(memoryNameSchema.parse("valid-memory")).toBe("valid-memory");
    });

    it("should accept names with underscores", () => {
      expect(memoryNameSchema.parse("valid_memory")).toBe("valid_memory");
    });

    it("should accept nested directory paths", () => {
      expect(memoryNameSchema.parse("architecture/overview")).toBe("architecture/overview");
    });

    it("should accept alphanumeric names", () => {
      expect(memoryNameSchema.parse("memory123")).toBe("memory123");
    });
  });

  // ── #004: import_prd rejects paths outside project directory ──

  describe("readPrdFile path restriction (#004)", () => {
    it("should reject /etc/passwd (absolute path outside project)", async () => {
      await expect(readPrdFile("/etc/passwd")).rejects.toThrow("Path outside project directory");
    });

    it("should reject relative traversal to system files", async () => {
      // This resolves to a path outside the project
      await expect(readPrdFile("../../../etc/passwd")).rejects.toThrow(
        /Path outside project directory|Unsupported file extension/,
      );
    });

    it("should reject files with unsupported extensions", async () => {
      // Even if inside project dir, .js files are not allowed
      await expect(readPrdFile("./src/cli/index.ts")).rejects.toThrow("Unsupported file extension");
    });

    it("should reject path with null bytes", async () => {
      await expect(readPrdFile("test\0.md")).rejects.toThrow();
    });
  });
});
