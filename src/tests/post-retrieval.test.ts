import { describe, it, expect } from "vitest";
import {
  deduplicateResults,
  rerankByKeywordOverlap,
  stitchAdjacentChunks,
  postRetrievalPipeline,
} from "../core/rag/post-retrieval.js";
import type { RankedResult } from "../core/rag/multi-strategy-retrieval.js";

function makeResult(overrides: Partial<RankedResult> & { id: string }): RankedResult {
  return {
    sourceType: "docs",
    sourceId: "src-1",
    title: "Test Doc",
    content: "Default content for testing.",
    score: 0.5,
    qualityScore: 0.7,
    strategies: ["fts"],
    ...overrides,
  };
}

describe("post-retrieval", () => {
  // ── deduplicateResults ─────────────────────────────────

  describe("deduplicateResults", () => {
    it("should remove results with identical content", () => {
      const results = [
        makeResult({ id: "a", content: "Same content here", score: 0.9 }),
        makeResult({ id: "b", content: "Same content here", score: 0.7 }),
        makeResult({ id: "c", content: "Different content", score: 0.5 }),
      ];

      const deduped = deduplicateResults(results);

      expect(deduped).toHaveLength(2);
      // Should keep the higher-scored one
      expect(deduped[0].id).toBe("a");
      expect(deduped[1].id).toBe("c");
    });

    it("should return all results when no duplicates exist", () => {
      const results = [
        makeResult({ id: "a", content: "Content A" }),
        makeResult({ id: "b", content: "Content B" }),
      ];

      expect(deduplicateResults(results)).toHaveLength(2);
    });

    it("should handle empty array", () => {
      expect(deduplicateResults([])).toEqual([]);
    });
  });

  // ── rerankByKeywordOverlap ─────────────────────────────

  describe("rerankByKeywordOverlap", () => {
    it("should boost results with more query keyword overlap", () => {
      const results = [
        makeResult({ id: "a", content: "knowledge store database", score: 0.5 }),
        makeResult({ id: "b", content: "knowledge store deduplication hash", score: 0.4 }),
      ];

      const reranked = rerankByKeywordOverlap(results, "knowledge store deduplication");

      // Result B has more keyword overlap with the query
      expect(reranked[0].id).toBe("b");
    });

    it("should not modify results when query has no keywords", () => {
      const results = [
        makeResult({ id: "a", score: 0.9 }),
        makeResult({ id: "b", score: 0.5 }),
      ];

      const reranked = rerankByKeywordOverlap(results, "the a an");
      expect(reranked[0].id).toBe("a");
    });
  });

  // ── stitchAdjacentChunks ───────────────────────────────

  describe("stitchAdjacentChunks", () => {
    it("should merge adjacent chunks from the same source", () => {
      const results = [
        makeResult({
          id: "a",
          sourceId: "doc:1",
          content: "Part one of the document.",
          score: 0.9,
        }),
        makeResult({
          id: "b",
          sourceId: "doc:1",
          content: "Part two of the document.",
          score: 0.8,
        }),
      ];

      // Metadata simulating chunk indices
      const chunkMeta = new Map<string, number>([
        ["a", 0],
        ["b", 1],
      ]);

      const stitched = stitchAdjacentChunks(results, chunkMeta);

      expect(stitched).toHaveLength(1);
      expect(stitched[0].content).toContain("Part one");
      expect(stitched[0].content).toContain("Part two");
    });

    it("should not merge chunks from different sources", () => {
      const results = [
        makeResult({ id: "a", sourceId: "doc:1", score: 0.9 }),
        makeResult({ id: "b", sourceId: "doc:2", score: 0.8 }),
      ];

      const chunkMeta = new Map<string, number>([
        ["a", 0],
        ["b", 1],
      ]);

      const stitched = stitchAdjacentChunks(results, chunkMeta);
      expect(stitched).toHaveLength(2);
    });

    it("should handle empty chunk metadata gracefully", () => {
      const results = [makeResult({ id: "a" })];
      const stitched = stitchAdjacentChunks(results, new Map());
      expect(stitched).toHaveLength(1);
    });
  });

  // ── postRetrievalPipeline (integration) ────────────────

  describe("postRetrievalPipeline", () => {
    it("should run full pipeline: dedup + rerank + stitch", () => {
      const results = [
        makeResult({ id: "a", content: "knowledge store query", score: 0.9 }),
        makeResult({ id: "b", content: "knowledge store query", score: 0.7 }), // duplicate
        makeResult({ id: "c", content: "unrelated topic here", score: 0.5 }),
      ];

      const output = postRetrievalPipeline({
        query: "knowledge store",
        results,
        maxResults: 10,
      });

      // Should have deduped the duplicate
      expect(output.results.length).toBeLessThan(results.length);
      expect(output.deduplicated).toBeGreaterThan(0);
    });

    it("should respect maxResults limit", () => {
      const results = Array.from({ length: 20 }, (_, i) =>
        makeResult({ id: `r${i}`, content: `Content ${i}`, score: 1 - i * 0.01 }),
      );

      const output = postRetrievalPipeline({
        query: "test",
        results,
        maxResults: 5,
      });

      expect(output.results).toHaveLength(5);
    });
  });
});
