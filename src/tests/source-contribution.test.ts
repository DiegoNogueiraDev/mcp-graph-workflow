import { describe, it, expect } from "vitest";
import {
  calculateSourceContributions,
  identifyUnderutilizedSources,
  type SourceContribution,
  type TraceAggregation,
} from "../core/rag/source-contribution.js";

describe("source-contribution", () => {
  describe("calculateSourceContributions", () => {
    it("should calculate contribution per source type", () => {
      const traces: TraceAggregation[] = [
        {
          sourceType: "prd",
          retrievalCount: 10,
          totalRelevanceScore: 7.5,
          helpfulCount: 5,
          unhelpfulCount: 1,
          totalTokens: 3000,
        },
        {
          sourceType: "docs",
          retrievalCount: 8,
          totalRelevanceScore: 6.0,
          helpfulCount: 4,
          unhelpfulCount: 0,
          totalTokens: 2000,
        },
      ];

      const contributions = calculateSourceContributions(traces, 20);

      expect(contributions).toHaveLength(2);

      const prd = contributions.find((c) => c.sourceType === "prd")!;
      expect(prd.retrievalHitRate).toBeCloseTo(0.5); // 10/20
      expect(prd.avgRelevanceScore).toBeCloseTo(0.75); // 7.5/10
      expect(prd.helpfulFeedbackRate).toBeCloseTo(5 / 6); // 5/(5+1)
    });

    it("should handle zero total queries", () => {
      const traces: TraceAggregation[] = [
        {
          sourceType: "memory",
          retrievalCount: 0,
          totalRelevanceScore: 0,
          helpfulCount: 0,
          unhelpfulCount: 0,
          totalTokens: 0,
        },
      ];

      const contributions = calculateSourceContributions(traces, 0);

      expect(contributions).toHaveLength(1);
      expect(contributions[0].retrievalHitRate).toBe(0);
    });

    it("should return empty array for empty traces", () => {
      expect(calculateSourceContributions([], 10)).toEqual([]);
    });
  });

  describe("identifyUnderutilizedSources", () => {
    it("should flag sources with low retrieval hit rate", () => {
      const contributions: SourceContribution[] = [
        {
          sourceType: "prd",
          documentCount: 50,
          retrievalHitRate: 0.6,
          avgRelevanceScore: 0.8,
          helpfulFeedbackRate: 0.9,
          tokenContribution: 0.4,
        },
        {
          sourceType: "journey",
          documentCount: 20,
          retrievalHitRate: 0.02,
          avgRelevanceScore: 0.3,
          helpfulFeedbackRate: 0,
          tokenContribution: 0.01,
        },
      ];

      const underutilized = identifyUnderutilizedSources(contributions);

      expect(underutilized).toHaveLength(1);
      expect(underutilized[0].sourceType).toBe("journey");
      expect(underutilized[0].reason).toBeTruthy();
    });

    it("should return empty when all sources are well-utilized", () => {
      const contributions: SourceContribution[] = [
        {
          sourceType: "docs",
          documentCount: 30,
          retrievalHitRate: 0.5,
          avgRelevanceScore: 0.7,
          helpfulFeedbackRate: 0.8,
          tokenContribution: 0.3,
        },
      ];

      expect(identifyUnderutilizedSources(contributions)).toEqual([]);
    });
  });
});
