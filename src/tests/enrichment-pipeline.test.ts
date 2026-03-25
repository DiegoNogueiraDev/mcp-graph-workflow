import { describe, it, expect } from "vitest";
import { enrichChunk, extractKeywords, extractEntities, generateSummary } from "../core/rag/enrichment-pipeline.js";
import type { TextChunk } from "../core/rag/chunk-text.js";

describe("enrichment-pipeline", () => {
  // ── extractKeywords ─────────────────────────────────────

  describe("extractKeywords", () => {
    it("should extract top-N keywords from text using TF-IDF scoring", () => {
      const text = "The SqliteStore handles database migrations and schema versioning. " +
        "Migrations are applied sequentially to ensure data integrity. " +
        "Each migration modifies the SQLite schema safely.";

      const keywords = extractKeywords(text, 5);

      expect(keywords.length).toBeLessThanOrEqual(5);
      expect(keywords.length).toBeGreaterThan(0);
      // "migration" or "schema" should appear as high-frequency terms
      const joined = keywords.join(" ").toLowerCase();
      expect(joined).toMatch(/migration|schema|sqlite/);
    });

    it("should return empty array for empty text", () => {
      expect(extractKeywords("", 5)).toEqual([]);
    });

    it("should filter out stopwords", () => {
      const keywords = extractKeywords("the a an is are was were for with", 5);
      expect(keywords).toEqual([]);
    });

    it("should handle single-word text", () => {
      const keywords = extractKeywords("typescript", 5);
      expect(keywords).toHaveLength(1);
      expect(keywords[0]).toBe("typescript");
    });
  });

  // ── extractEntities ─────────────────────────────────────

  describe("extractEntities", () => {
    it("should detect PascalCase class/type names", () => {
      const text = "The GraphNode and SqliteStore are core types used by KnowledgeStore.";
      const entities = extractEntities(text);

      expect(entities).toContain("GraphNode");
      expect(entities).toContain("SqliteStore");
      expect(entities).toContain("KnowledgeStore");
    });

    it("should detect camelCase function names", () => {
      const text = "Call findNextTask() and then buildTaskContext() for the result.";
      const entities = extractEntities(text);

      expect(entities).toContain("findNextTask");
      expect(entities).toContain("buildTaskContext");
    });

    it("should detect file paths", () => {
      const text = "See src/core/rag/chunk-text.ts for the chunking logic.";
      const entities = extractEntities(text);

      expect(entities).toContain("src/core/rag/chunk-text.ts");
    });

    it("should return empty array for text without entities", () => {
      const text = "this is plain text without any special names or paths";
      const entities = extractEntities(text);
      expect(entities).toEqual([]);
    });

    it("should deduplicate entities", () => {
      const text = "Use GraphNode here and GraphNode there.";
      const entities = extractEntities(text);
      const graphNodeCount = entities.filter((e) => e === "GraphNode").length;
      expect(graphNodeCount).toBe(1);
    });
  });

  // ── generateSummary ─────────────────────────────────────

  describe("generateSummary", () => {
    it("should return the first sentence of the chunk", () => {
      const text = "This module handles PRD parsing. It splits text into segments. Then classifies each.";
      const summary = generateSummary(text);

      expect(summary).toBe("This module handles PRD parsing.");
    });

    it("should return markdown heading if present", () => {
      const text = "## Authentication Flow\n\nThe auth system uses JWT tokens.";
      const summary = generateSummary(text);

      expect(summary).toBe("Authentication Flow");
    });

    it("should truncate long summaries", () => {
      const longSentence = "A".repeat(300) + ".";
      const summary = generateSummary(longSentence);
      expect(summary.length).toBeLessThanOrEqual(200);
    });

    it("should return empty string for empty text", () => {
      expect(generateSummary("")).toBe("");
    });
  });

  // ── enrichChunk ─────────────────────────────────────────

  describe("enrichChunk", () => {
    it("should enrich a chunk with keywords, entities, and summary", () => {
      const chunk: TextChunk = {
        index: 0,
        content: "The KnowledgeStore class provides CRUD operations for knowledge_documents. " +
          "It uses SqliteStore for persistence and supports FTS5 search.",
        tokens: 30,
      };

      const enriched = enrichChunk(chunk, "docs");

      expect(enriched.index).toBe(0);
      expect(enriched.content).toBe(chunk.content);
      expect(enriched.tokens).toBe(chunk.tokens);
      expect(enriched.keywords.length).toBeGreaterThan(0);
      expect(enriched.entities.length).toBeGreaterThan(0);
      expect(enriched.summary.length).toBeGreaterThan(0);
      expect(enriched.sourceType).toBe("docs");
    });

    it("should preserve original chunk properties", () => {
      const chunk: TextChunk = { index: 3, content: "Simple text.", tokens: 3 };
      const enriched = enrichChunk(chunk, "memory");

      expect(enriched.index).toBe(3);
      expect(enriched.content).toBe("Simple text.");
      expect(enriched.tokens).toBe(3);
      expect(enriched.sourceType).toBe("memory");
    });

    it("should set parentChunkIndex when provided", () => {
      const chunk: TextChunk = { index: 1, content: "Child chunk.", tokens: 3 };
      const enriched = enrichChunk(chunk, "prd", 0);

      expect(enriched.parentChunkIndex).toBe(0);
    });

    it("should leave parentChunkIndex undefined when not provided", () => {
      const chunk: TextChunk = { index: 0, content: "Root chunk.", tokens: 3 };
      const enriched = enrichChunk(chunk, "prd");

      expect(enriched.parentChunkIndex).toBeUndefined();
    });
  });
});
