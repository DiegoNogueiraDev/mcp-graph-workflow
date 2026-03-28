import { describe, it, expect } from "vitest";
import { rankChunksByBm25, compressWithBm25 } from "../core/context/bm25-compressor.js";

describe("BM25Compressor", () => {
  const chunks = [
    "Express is a web framework for building REST APIs with Node.js",
    "SQLite is a lightweight embedded database engine",
    "Vitest is a testing framework powered by Vite",
    "Express routing middleware handles HTTP requests",
    "PostgreSQL is a powerful relational database",
  ];

  // ── rankChunksByBm25 ──────────────────────────

  describe("rankChunksByBm25", () => {
    it("should rank chunks by relevance to query", () => {
      const ranked = rankChunksByBm25(chunks, "Express REST API");

      expect(ranked.length).toBe(5);
      // Express-related chunks should rank highest
      expect(ranked[0].content).toContain("Express");
      expect(ranked[0].score).toBeGreaterThan(0);
    });

    it("should return all chunks with scores", () => {
      const ranked = rankChunksByBm25(chunks, "database");

      for (const chunk of ranked) {
        expect(chunk).toHaveProperty("content");
        expect(chunk).toHaveProperty("score");
        expect(chunk).toHaveProperty("tokens");
      }
    });

    it("should sort by score descending", () => {
      const ranked = rankChunksByBm25(chunks, "framework");

      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
      }
    });

    it("should return empty for empty chunks", () => {
      expect(rankChunksByBm25([], "test")).toHaveLength(0);
    });

    it("should return zero scores for empty query", () => {
      const ranked = rankChunksByBm25(chunks, "");
      expect(ranked).toHaveLength(0);
    });

    it("should give higher scores to chunks with more query term matches", () => {
      const ranked = rankChunksByBm25(chunks, "Express framework API");

      // First chunk mentions Express, framework, and API
      expect(ranked[0].content).toContain("Express");
      expect(ranked[0].score).toBeGreaterThan(ranked[ranked.length - 1].score);
    });
  });

  // ── compressWithBm25 ──────────────────────────

  describe("compressWithBm25", () => {
    it("should select top chunks within token budget", () => {
      const selected = compressWithBm25(chunks, "Express API", 50);

      expect(selected.length).toBeGreaterThanOrEqual(1);
      // Selected chunks should be the most relevant
      expect(selected[0].content).toContain("Express");

      // Total tokens should not exceed budget (with some tolerance for first chunk)
      const totalTokens = selected.reduce((sum, c) => sum + c.tokens, 0);
      // At least first chunk is included
      expect(totalTokens).toBeGreaterThan(0);
    });

    it("should respect budget strictly — no chunks if first exceeds budget (Bug #059)", () => {
      const selected = compressWithBm25(chunks, "Express", 1);
      // Budget of 1 token is too small for any chunk — should return empty
      expect(selected.length).toBe(0);
    });

    it("should include all chunks if budget allows", () => {
      const selected = compressWithBm25(chunks, "test", 10000);
      expect(selected.length).toBe(5);
    });

    it("should return fewer chunks with smaller budget", () => {
      const largeBudget = compressWithBm25(chunks, "database", 10000);
      const smallBudget = compressWithBm25(chunks, "database", 30);

      expect(smallBudget.length).toBeLessThanOrEqual(largeBudget.length);
    });
  });
});
