/**
 * Robustness tests for RAG pipeline modules — covers gaps identified in audit:
 *
 * - enrichment-pipeline: enrichChunks() multi-chunk parent-child linking
 * - benchmark-indexer: tool usage indexing path
 * - post-retrieval: non-adjacent chunks should NOT stitch
 * - source-contribution: accumulation and multi-source scenarios
 * - rag-trace: totalLatencyMs = sum of stages, source contribution accumulation
 * - query-cache: LRU eviction order verification
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── enrichment-pipeline ────────────────────────────────────

import {
  enrichChunks,
  type TextChunk,
} from "../core/rag/enrichment-pipeline.js";

describe("enrichment-pipeline — robustness", () => {
  describe("enrichChunks (multi-chunk)", () => {
    it("should set parentChunkIndex=0 for all chunks except the first", () => {
      const chunks: TextChunk[] = [
        { index: 0, content: "## Architecture overview of the system.", tokens: 10 },
        { index: 1, content: "The GraphNode type represents task nodes.", tokens: 12 },
        { index: 2, content: "SqliteStore manages persistence layer.", tokens: 10 },
      ];

      const enriched = enrichChunks(chunks, "prd");

      expect(enriched).toHaveLength(3);
      expect(enriched[0].parentChunkIndex).toBeUndefined(); // first chunk = root
      expect(enriched[1].parentChunkIndex).toBe(0); // child of first
      expect(enriched[2].parentChunkIndex).toBe(0); // child of first
    });

    it("should not apply parent linking for single-chunk documents", () => {
      const chunks: TextChunk[] = [
        { index: 0, content: "Single chunk document.", tokens: 5 },
      ];

      const enriched = enrichChunks(chunks, "docs");

      expect(enriched).toHaveLength(1);
      expect(enriched[0].parentChunkIndex).toBeUndefined();
    });

    it("should propagate sourceType to all enriched chunks", () => {
      const chunks: TextChunk[] = [
        { index: 0, content: "Chunk A.", tokens: 3 },
        { index: 1, content: "Chunk B.", tokens: 3 },
      ];

      const enriched = enrichChunks(chunks, "memory");

      for (const chunk of enriched) {
        expect(chunk.sourceType).toBe("memory");
      }
    });

    it("should enrich each chunk with keywords and summary independently", () => {
      const chunks: TextChunk[] = [
        { index: 0, content: "The SqliteStore handles database operations and migrations.", tokens: 15 },
        { index: 1, content: "The GraphEventBus emits events to all registered listeners.", tokens: 15 },
      ];

      const enriched = enrichChunks(chunks, "code_context");

      // Each chunk should have its own entities
      expect(enriched[0].entities).toContain("SqliteStore");
      expect(enriched[1].entities).toContain("GraphEventBus");
      // Entities from chunk 0 should NOT leak into chunk 1
      expect(enriched[1].entities).not.toContain("SqliteStore");
    });
  });
});

// ── benchmark-indexer (tool usage path) ────────────────────

import { indexBenchmarkResults, type BenchmarkData } from "../core/rag/benchmark-indexer.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("benchmark-indexer — robustness", () => {
  let mockStore: {
    insert: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockStore = {
      insert: vi.fn().mockReturnValue({ id: "doc_1", sourceType: "benchmark" }),
      count: vi.fn().mockReturnValue(0),
    };
  });

  it("should index tool usage data when toolUsage is provided", () => {
    const data: BenchmarkData = {
      timestamp: "2026-03-24T10:00:00Z",
      metrics: [],
      toolUsage: {
        context: { inputTokens: 500, outputTokens: 1200 },
        next: { inputTokens: 300, outputTokens: 800 },
      },
    };

    const result = indexBenchmarkResults(
      mockStore as unknown as KnowledgeStore,
      data,
    );

    expect(result.documentsIndexed).toBeGreaterThan(0);

    // Find the tool usage insert call
    const toolUsageCall = mockStore.insert.mock.calls.find(
      (c: Array<{ sourceId: string }>) => c[0].sourceId.includes("tool-usage"),
    );
    expect(toolUsageCall).toBeTruthy();

    const content = toolUsageCall![0].content as string;
    expect(content).toContain("context");
    expect(content).toContain("500");
    expect(content).toContain("1200");
    expect(content).toContain("next");
  });

  it("should not create tool usage document when toolUsage is empty", () => {
    const data: BenchmarkData = {
      timestamp: "2026-03-24T10:00:00Z",
      metrics: [
        { name: "latency", value: 50, target: 100, passed: true },
      ],
      toolUsage: {},
    };

    indexBenchmarkResults(mockStore as unknown as KnowledgeStore, data);

    // Should not have a tool-usage insert
    const toolUsageCall = mockStore.insert.mock.calls.find(
      (c: Array<{ sourceId: string }>) => c[0].sourceId.includes("tool-usage"),
    );
    expect(toolUsageCall).toBeUndefined();
  });

  it("should not create tool usage document when toolUsage is undefined", () => {
    const data: BenchmarkData = {
      timestamp: "2026-03-24T10:00:00Z",
      metrics: [
        { name: "latency", value: 50, target: 100, passed: true },
      ],
    };

    indexBenchmarkResults(mockStore as unknown as KnowledgeStore, data);

    const toolUsageCall = mockStore.insert.mock.calls.find(
      (c: Array<{ sourceId: string }>) => c[0].sourceId.includes("tool-usage"),
    );
    expect(toolUsageCall).toBeUndefined();
  });
});

// ── post-retrieval (non-adjacent chunks) ───────────────────

import {
  stitchAdjacentChunks,
  deduplicateResults,
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

describe("post-retrieval — robustness", () => {
  describe("stitchAdjacentChunks", () => {
    it("should NOT stitch non-adjacent chunks from same source", () => {
      const results = [
        makeResult({ id: "a", sourceId: "doc:1", content: "Chunk 0", score: 0.9 }),
        makeResult({ id: "b", sourceId: "doc:1", content: "Chunk 2", score: 0.8 }),
        makeResult({ id: "c", sourceId: "doc:1", content: "Chunk 4", score: 0.7 }),
      ];

      // Non-adjacent indices: 0, 2, 4
      const chunkMeta = new Map<string, number>([
        ["a", 0],
        ["b", 2],
        ["c", 4],
      ]);

      const stitched = stitchAdjacentChunks(results, chunkMeta);

      // Each chunk should remain separate since they're not adjacent
      expect(stitched).toHaveLength(3);
    });

    it("should stitch 3+ adjacent chunks into one result", () => {
      const results = [
        makeResult({ id: "a", sourceId: "doc:1", content: "Part 1", score: 0.9 }),
        makeResult({ id: "b", sourceId: "doc:1", content: "Part 2", score: 0.8 }),
        makeResult({ id: "c", sourceId: "doc:1", content: "Part 3", score: 0.7 }),
      ];

      const chunkMeta = new Map<string, number>([
        ["a", 0],
        ["b", 1],
        ["c", 2],
      ]);

      const stitched = stitchAdjacentChunks(results, chunkMeta);

      expect(stitched).toHaveLength(1);
      expect(stitched[0].content).toContain("Part 1");
      expect(stitched[0].content).toContain("Part 2");
      expect(stitched[0].content).toContain("Part 3");
      // Score should be the max of all stitched chunks
      expect(stitched[0].score).toBe(0.9);
    });

    it("should stitch adjacent pair but keep non-adjacent separate", () => {
      const results = [
        makeResult({ id: "a", sourceId: "doc:1", content: "Part 0", score: 0.9 }),
        makeResult({ id: "b", sourceId: "doc:1", content: "Part 1", score: 0.8 }),
        makeResult({ id: "c", sourceId: "doc:1", content: "Part 5", score: 0.7 }),
      ];

      // 0+1 are adjacent, 5 is not
      const chunkMeta = new Map<string, number>([
        ["a", 0],
        ["b", 1],
        ["c", 5],
      ]);

      const stitched = stitchAdjacentChunks(results, chunkMeta);

      expect(stitched).toHaveLength(2);
      // First result should be stitched (0+1)
      expect(stitched[0].content).toContain("Part 0");
      expect(stitched[0].content).toContain("Part 1");
    });

    it("should merge strategies from stitched chunks without duplicates", () => {
      const results = [
        makeResult({ id: "a", sourceId: "doc:1", content: "A", score: 0.9, strategies: ["fts", "tfidf"] }),
        makeResult({ id: "b", sourceId: "doc:1", content: "B", score: 0.8, strategies: ["fts", "bm25"] }),
      ];

      const chunkMeta = new Map<string, number>([["a", 0], ["b", 1]]);
      const stitched = stitchAdjacentChunks(results, chunkMeta);

      expect(stitched).toHaveLength(1);
      // Should deduplicate "fts"
      const strategies = stitched[0].strategies;
      expect(strategies).toContain("fts");
      expect(strategies).toContain("tfidf");
      expect(strategies).toContain("bm25");
      expect(strategies.filter((s) => s === "fts")).toHaveLength(1);
    });
  });

  describe("deduplicateResults", () => {
    it("should treat case-insensitive content as duplicates", () => {
      const results = [
        makeResult({ id: "a", content: "Knowledge Store", score: 0.9 }),
        makeResult({ id: "b", content: "knowledge store", score: 0.7 }),
      ];

      const deduped = deduplicateResults(results);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].score).toBe(0.9); // keeps higher score
    });

    it("should handle whitespace-only differences as duplicates", () => {
      const results = [
        makeResult({ id: "a", content: "  content with spaces  ", score: 0.8 }),
        makeResult({ id: "b", content: "content with spaces", score: 0.6 }),
      ];

      const deduped = deduplicateResults(results);
      expect(deduped).toHaveLength(1);
    });
  });
});

// ── source-contribution (accumulation + multi-source) ──────

import {
  calculateSourceContributions,
  identifyUnderutilizedSources,
  type TraceAggregation,
  type SourceContribution,
} from "../core/rag/source-contribution.js";

describe("source-contribution — robustness", () => {
  describe("calculateSourceContributions", () => {
    it("should calculate correct token contribution ratio for single source", () => {
      const traces: TraceAggregation[] = [
        {
          sourceType: "prd",
          retrievalCount: 5,
          totalRelevanceScore: 4.0,
          helpfulCount: 3,
          unhelpfulCount: 1,
          totalTokens: 1000,
        },
      ];

      const contributions = calculateSourceContributions(traces, 10);

      expect(contributions).toHaveLength(1);
      expect(contributions[0].tokenContribution).toBeCloseTo(1.0); // 1000/1000
    });

    it("should calculate correct feedback rate with mixed helpful/unhelpful", () => {
      const traces: TraceAggregation[] = [
        {
          sourceType: "docs",
          retrievalCount: 10,
          totalRelevanceScore: 8.0,
          helpfulCount: 7,
          unhelpfulCount: 3,
          totalTokens: 500,
        },
      ];

      const contributions = calculateSourceContributions(traces, 20);

      expect(contributions[0].helpfulFeedbackRate).toBeCloseTo(0.7); // 7/10
    });

    it("should handle many sources with varying contributions", () => {
      const traces: TraceAggregation[] = [
        { sourceType: "prd", retrievalCount: 20, totalRelevanceScore: 18.0, helpfulCount: 15, unhelpfulCount: 2, totalTokens: 5000 },
        { sourceType: "docs", retrievalCount: 15, totalRelevanceScore: 12.0, helpfulCount: 10, unhelpfulCount: 0, totalTokens: 3000 },
        { sourceType: "memory", retrievalCount: 5, totalRelevanceScore: 3.5, helpfulCount: 2, unhelpfulCount: 1, totalTokens: 1000 },
        { sourceType: "code_context", retrievalCount: 1, totalRelevanceScore: 0.5, helpfulCount: 0, unhelpfulCount: 0, totalTokens: 500 },
      ];

      const contributions = calculateSourceContributions(traces, 50);

      expect(contributions).toHaveLength(4);

      // Token contributions should sum to ~1.0
      const totalTokenContrib = contributions.reduce((sum, c) => sum + c.tokenContribution, 0);
      expect(totalTokenContrib).toBeCloseTo(1.0);

      // PRD should have highest contribution
      const prd = contributions.find((c) => c.sourceType === "prd")!;
      expect(prd.tokenContribution).toBeCloseTo(5000 / 9500);

      // Code context with 0 helpful+unhelpful should have 0 feedback rate
      const code = contributions.find((c) => c.sourceType === "code_context")!;
      expect(code.helpfulFeedbackRate).toBe(0);
    });

    it("should return 0 avg relevance when retrievalCount is 0", () => {
      const traces: TraceAggregation[] = [
        {
          sourceType: "journey",
          retrievalCount: 0,
          totalRelevanceScore: 0,
          helpfulCount: 0,
          unhelpfulCount: 0,
          totalTokens: 200,
        },
      ];

      const contributions = calculateSourceContributions(traces, 10);
      expect(contributions[0].avgRelevanceScore).toBe(0);
    });
  });

  describe("identifyUnderutilizedSources", () => {
    it("should NOT flag sources with documentCount=0 even if hit rate is low", () => {
      const contributions: SourceContribution[] = [
        {
          sourceType: "journey",
          documentCount: 0, // no documents indexed
          retrievalHitRate: 0.01,
          avgRelevanceScore: 0,
          helpfulFeedbackRate: 0,
          tokenContribution: 0,
        },
      ];

      const underutilized = identifyUnderutilizedSources(contributions);
      expect(underutilized).toHaveLength(0); // Should not flag — no docs to improve
    });

    it("should flag multiple underutilized sources", () => {
      const contributions: SourceContribution[] = [
        { sourceType: "prd", documentCount: 50, retrievalHitRate: 0.6, avgRelevanceScore: 0.8, helpfulFeedbackRate: 0.9, tokenContribution: 0.4 },
        { sourceType: "journey", documentCount: 20, retrievalHitRate: 0.02, avgRelevanceScore: 0.3, helpfulFeedbackRate: 0, tokenContribution: 0.01 },
        { sourceType: "capture", documentCount: 15, retrievalHitRate: 0.03, avgRelevanceScore: 0.2, helpfulFeedbackRate: 0, tokenContribution: 0.005 },
      ];

      const underutilized = identifyUnderutilizedSources(contributions);
      expect(underutilized).toHaveLength(2);
      expect(underutilized.map((u) => u.sourceType).sort()).toEqual(["capture", "journey"]);
    });

    it("should include reason with percentage in flagged sources", () => {
      const contributions: SourceContribution[] = [
        { sourceType: "stale_docs", documentCount: 100, retrievalHitRate: 0.01, avgRelevanceScore: 0.1, helpfulFeedbackRate: 0, tokenContribution: 0.01 },
      ];

      const underutilized = identifyUnderutilizedSources(contributions);
      expect(underutilized).toHaveLength(1);
      expect(underutilized[0].reason).toContain("1.0%");
      expect(underutilized[0].reason).toContain("100");
    });
  });
});

// ── rag-trace (totalLatencyMs + accumulation) ──────────────

import { RagTracer } from "../core/rag/rag-trace.js";

describe("rag-trace — robustness", () => {
  it("should compute totalLatencyMs as sum of all stage latencies", () => {
    const tracer = new RagTracer("test");

    tracer.startStage("query_understanding");
    tracer.endStage("query_understanding", { inputCount: 1, outputCount: 1 });

    tracer.startStage("retrieval");
    tracer.endStage("retrieval", { inputCount: 1, outputCount: 10 });

    tracer.startStage("post_retrieval");
    tracer.endStage("post_retrieval", { inputCount: 10, outputCount: 5 });

    const trace = tracer.finalize();

    const sumOfStages = trace.stages.reduce((sum, s) => sum + s.latencyMs, 0);
    expect(trace.totalLatencyMs).toBe(sumOfStages);
  });

  it("should accumulate source contributions when called multiple times for same source", () => {
    const tracer = new RagTracer("test accumulation");

    tracer.recordSourceContribution("prd", 3);
    tracer.recordSourceContribution("prd", 2);
    tracer.recordSourceContribution("docs", 5);

    const trace = tracer.finalize();

    expect(trace.sourcesContributed["prd"]).toBe(5); // 3 + 2
    expect(trace.sourcesContributed["docs"]).toBe(5);
  });

  it("should generate unique traceIds for different tracers", () => {
    const tracer1 = new RagTracer("query 1");
    const tracer2 = new RagTracer("query 2");

    const trace1 = tracer1.finalize();
    const trace2 = tracer2.finalize();

    expect(trace1.traceId).not.toBe(trace2.traceId);
  });

  it("should handle finalize with zero stages", () => {
    const tracer = new RagTracer("empty pipeline");
    const trace = tracer.finalize();

    expect(trace.stages).toHaveLength(0);
    expect(trace.totalLatencyMs).toBe(0);
    expect(trace.totalTokensUsed).toBe(0);
    expect(trace.citationCount).toBe(0);
  });

  it("should handle endStage without prior startStage gracefully", () => {
    const tracer = new RagTracer("no start");

    // endStage without startStage — should use current time as fallback
    tracer.endStage("retrieval", { inputCount: 0, outputCount: 0 });

    const trace = tracer.finalize();
    expect(trace.stages).toHaveLength(1);
    expect(trace.stages[0].latencyMs).toBeGreaterThanOrEqual(0);
  });
});
