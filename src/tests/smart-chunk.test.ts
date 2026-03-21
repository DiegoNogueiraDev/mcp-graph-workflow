import { describe, it, expect } from "vitest";
import { smartChunk } from "../core/rag/chunk-text.js";
import { chunkText } from "../core/rag/chunk-text.js";

describe("Smart Chunking", () => {
  describe("smartChunk", () => {
    it("should return empty array for empty text", () => {
      expect(smartChunk("", "memory")).toEqual([]);
    });

    it("should return single chunk for short text", () => {
      const chunks = smartChunk("Short text", "memory");
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe("Short text");
    });

    it("should chunk docs content preserving code blocks", () => {
      const text = `# Introduction\n\nSome intro text.\n\n\`\`\`typescript\nconst x = 1;\nconst y = 2;\n\`\`\`\n\n# Second Section\n\nMore text here about the documentation. ${"This is filler content. ".repeat(50)}`;
      const chunks = smartChunk(text, "docs");
      expect(chunks.length).toBeGreaterThan(0);
      // Code block should be kept together if possible
      const codeChunk = chunks.find((c) => c.content.includes("const x = 1"));
      expect(codeChunk).toBeTruthy();
    });

    it("should chunk PRD by markdown headers", () => {
      const text = `# Epic\n\nOverview of epic.\n\n## Feature 1\n\nDescription of feature 1. ${"Content. ".repeat(100)}\n\n## Feature 2\n\nDescription of feature 2. ${"More content. ".repeat(100)}`;
      const chunks = smartChunk(text, "prd");
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should use smaller chunks for memory/ai_decision", () => {
      const text = "Learning from implementation. ".repeat(100);
      const memoryChunks = smartChunk(text, "memory");
      const docsChunks = smartChunk(text, "docs");
      // Memory chunks should be smaller (300 tokens) vs docs (800 tokens)
      expect(memoryChunks.length).toBeGreaterThanOrEqual(docsChunks.length);
    });

    it("should fall back to default chunkText for unknown source types", () => {
      const text = "Default chunking behavior. ".repeat(200);
      const smartChunks = smartChunk(text, "upload");
      const defaultChunks = chunkText(text);
      // Should produce similar results to default
      expect(smartChunks.length).toBeGreaterThan(0);
      expect(Math.abs(smartChunks.length - defaultChunks.length)).toBeLessThanOrEqual(1);
    });

    it("should handle code_context with function boundaries", () => {
      const text = `export function foo() {\n  return 1;\n}\n\nexport function bar() {\n  return 2;\n}\n\n${"export function fn" + "() { return 0; }\n\n".repeat(60)}`;
      const chunks = smartChunk(text, "code_context");
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
