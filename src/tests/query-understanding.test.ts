import { describe, it, expect } from "vitest";
import {
  understandQuery,
  detectIntent,
  detectSourceFilter,
  expandQuery,
} from "../core/rag/query-understanding.js";

describe("query-understanding", () => {
  // ── detectIntent ───────────────────────────────────────

  describe("detectIntent", () => {
    it("should detect 'how_to' intent for questions starting with how", () => {
      expect(detectIntent("how do I create a new node?")).toBe("how_to");
      expect(detectIntent("How to parse a PRD file?")).toBe("how_to");
    });

    it("should detect 'status' intent for status-related queries", () => {
      expect(detectIntent("what is the status of task-123?")).toBe("status");
      expect(detectIntent("show progress of sprint 5")).toBe("status");
    });

    it("should detect 'debug' intent for error-related queries", () => {
      expect(detectIntent("why does the parser fail on PDF?")).toBe("debug");
      expect(detectIntent("error in knowledge store insert")).toBe("debug");
      expect(detectIntent("bug in FTS5 search")).toBe("debug");
    });

    it("should detect 'compare' intent for comparison queries", () => {
      expect(detectIntent("compare TF-IDF vs BM25 ranking")).toBe("compare");
      expect(detectIntent("difference between tiered and compact context")).toBe("compare");
    });

    it("should default to 'search' for generic queries", () => {
      expect(detectIntent("knowledge store")).toBe("search");
      expect(detectIntent("SqliteStore migrations")).toBe("search");
    });
  });

  // ── detectSourceFilter ─────────────────────────────────

  describe("detectSourceFilter", () => {
    it("should detect code-related source filters", () => {
      const filters = detectSourceFilter("in the code, how does GraphNode work?");
      expect(filters).toContain("code_context");
    });

    it("should detect PRD source filter", () => {
      const filters = detectSourceFilter("check the PRD for authentication requirements");
      expect(filters).toContain("prd");
    });

    it("should detect journey source filter", () => {
      const filters = detectSourceFilter("in the journey map, what screens exist?");
      expect(filters).toContain("journey");
    });

    it("should detect skill source filter", () => {
      const filters = detectSourceFilter("what skills are available for the review phase?");
      expect(filters).toContain("skill");
    });

    it("should return empty array for queries without source hints", () => {
      const filters = detectSourceFilter("find next task");
      expect(filters).toEqual([]);
    });
  });

  // ── expandQuery ────────────────────────────────────────

  describe("expandQuery", () => {
    it("should expand query with related technical terms", () => {
      const expanded = expandQuery("database migration");
      expect(expanded.length).toBeGreaterThan(0);
      // Should include original terms
      expect(expanded.join(" ")).toMatch(/database|migration/);
    });

    it("should return original tokens for unknown terms", () => {
      const expanded = expandQuery("xyzfoobar");
      expect(expanded).toContain("xyzfoobar");
    });
  });

  // ── understandQuery (integration) ──────────────────────

  describe("understandQuery", () => {
    it("should return a complete understanding result", () => {
      const result = understandQuery("how does the KnowledgeStore handle deduplication?");

      expect(result.originalQuery).toBe("how does the KnowledgeStore handle deduplication?");
      expect(result.rewrittenQuery.length).toBeGreaterThan(0);
      expect(result.intent).toBe("how_to");
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.entities).toContain("KnowledgeStore");
    });

    it("should detect entities from the query", () => {
      const result = understandQuery("explain SqliteStore and GraphNode relationship");

      expect(result.entities).toContain("SqliteStore");
      expect(result.entities).toContain("GraphNode");
    });

    it("should detect source type filters", () => {
      const result = understandQuery("search in the PRD for user stories");

      expect(result.sourceTypeFilter).toContain("prd");
    });

    it("should handle empty query gracefully", () => {
      const result = understandQuery("");

      expect(result.originalQuery).toBe("");
      expect(result.intent).toBe("search");
      expect(result.entities).toEqual([]);
    });
  });
});
