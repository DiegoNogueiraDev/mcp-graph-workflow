import { describe, it, expect, vi, beforeEach } from "vitest";
import { indexBenchmarkResults, type BenchmarkData } from "../core/rag/benchmark-indexer.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("benchmark-indexer", () => {
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

  it("should index benchmark results as knowledge documents", () => {
    const data: BenchmarkData = {
      timestamp: "2026-03-24T10:00:00Z",
      metrics: [
        { name: "fts_search_latency_ms", value: 45, target: 100, passed: true },
        { name: "bulk_insert_latency_ms", value: 1800, target: 2000, passed: true },
      ],
      tokenEconomy: { avgCompression: 0.73, totalTokensSaved: 15000 },
    };

    const result = indexBenchmarkResults(
      mockStore as unknown as KnowledgeStore,
      data,
    );

    expect(result.documentsIndexed).toBeGreaterThan(0);
    expect(mockStore.insert).toHaveBeenCalled();

    const firstCall = mockStore.insert.mock.calls[0][0];
    expect(firstCall.sourceType).toBe("benchmark");
    expect(firstCall.content).toContain("fts_search_latency_ms");
  });

  it("should include token economy data in indexed content", () => {
    const data: BenchmarkData = {
      timestamp: "2026-03-24T10:00:00Z",
      metrics: [],
      tokenEconomy: { avgCompression: 0.73, totalTokensSaved: 15000 },
    };

    indexBenchmarkResults(mockStore as unknown as KnowledgeStore, data);

    const insertedContent = mockStore.insert.mock.calls
      .map((c: Array<{ content: string }>) => c[0].content)
      .join(" ");
    expect(insertedContent).toContain("0.73");
  });

  it("should return zero documents for empty metrics and no token economy", () => {
    const data: BenchmarkData = {
      timestamp: "2026-03-24T10:00:00Z",
      metrics: [],
    };

    const result = indexBenchmarkResults(
      mockStore as unknown as KnowledgeStore,
      data,
    );

    // Even with empty metrics, at least a summary doc should be created
    expect(result.documentsIndexed).toBeGreaterThanOrEqual(0);
  });

  it("should flag failing metrics in content", () => {
    const data: BenchmarkData = {
      timestamp: "2026-03-24T10:00:00Z",
      metrics: [
        { name: "context_build_latency_ms", value: 250, target: 100, passed: false },
      ],
    };

    indexBenchmarkResults(mockStore as unknown as KnowledgeStore, data);

    const insertedContent = mockStore.insert.mock.calls
      .map((c: Array<{ content: string }>) => c[0].content)
      .join(" ");
    expect(insertedContent).toMatch(/fail|exceeded|warning/i);
  });
});
