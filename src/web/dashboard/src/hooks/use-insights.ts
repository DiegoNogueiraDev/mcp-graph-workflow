import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { computeHealthScore } from "@/lib/health-score";
import type { Metrics, Bottlenecks, GraphStats, KnowledgeStats } from "@/lib/types";

export interface InsightsData {
  metrics: Metrics;
  bottlenecks: Bottlenecks;
  stats: GraphStats;
  knowledgeStats: KnowledgeStats;
  healthScore: number;
}

export function useInsights(): {
  data: InsightsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metrics, bottlenecks, stats, knowledgeStats] = await Promise.all([
        apiClient.getMetrics() as Promise<Metrics>,
        apiClient.getBottlenecks() as Promise<Bottlenecks>,
        apiClient.getStats(),
        apiClient.getKnowledgeStats().catch((): KnowledgeStats => ({ total: 0, bySource: {} })),
      ]);

      const healthScore = computeHealthScore({
        completionRate: metrics.completionRate,
        totalNodes: stats.totalNodes,
        blockedCount: stats.byStatus.blocked ?? 0,
        missingACCount: bottlenecks.missingAcceptanceCriteria.length,
        oversizedCount: bottlenecks.oversizedTasks.length,
      });

      setData({ metrics, bottlenecks, stats, knowledgeStats, healthScore });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
