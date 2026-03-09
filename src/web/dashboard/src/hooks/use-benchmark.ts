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
    costSavings: {
      opusPerTask: number;
      sonnetPerTask: number;
    };
  };
  dependencyIntelligence: {
    totalEdges: number;
    inferredDeps: number;
    blockedTasks: number;
    cycles: number;
  };
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
