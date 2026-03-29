import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

export interface BenchmarkData {
  tokenEconomy: {
    totalNodes: number;
    totalEdges: number;
    avgCompressionPercent: number;
    sampleSize: number;
    perTaskMetrics: Array<{
      id: string;
      title: string;
      rawChars: number;
      compactChars: number;
      compressionPercent: number;
      estimatedTokens: number;
      estimatedTokensSaved: number;
    }>;
    totalTokensSaved: number;
    avgTokensPerTask: number;
    avgTokensSavedPerTask: number;
    costSavings: {
      opusCostPerTask: number;
      sonnetCostPerTask: number;
      opusSavedPerTask: number;
      sonnetSavedPerTask: number;
      opusTotalSaved: number;
      sonnetTotalSaved: number;
    };
  };
  dependencyIntelligence: {
    totalEdges: number;
    inferredDeps: number;
    blockedTasks: number;
    cycles: number;
  };
  toolTokenUsage?: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    perTool: Array<{
      toolName: string;
      callCount: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      avgInputTokens: number;
      avgOutputTokens: number;
      totalTokens: number;
    }>;
    recentCalls: Array<{
      id: number;
      toolName: string;
      inputTokens: number;
      outputTokens: number;
      calledAt: string;
    }>;
  } | null;
  layeredCompression?: {
    avgNaiveNeighborhoodTokens: number;
    avgCompactContextTokens: number;
    avgNeighborTruncatedTokens: number;
    avgDefaultOmittedTokens: number;
    avgShortKeysTokens: number;
    avgSummaryTierTokens: number;
    avgLayer1SavingsPercent: number;
    avgLayer2SavingsPercent: number;
    avgLayer3SavingsPercent: number;
    avgLayer4SavingsPercent: number;
    avgTotalRealSavingsPercent: number;
    sampleSize: number;
  } | null;
  formulas: Record<string, string>;
}

export function useBenchmark() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiClient.request<BenchmarkData>("/benchmark");
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load benchmark data");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return { data, loading, error };
}
