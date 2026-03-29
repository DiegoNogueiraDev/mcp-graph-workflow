import { useState, useEffect, useCallback, useRef } from "react";
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        apiClient.getMetrics() as Promise<Metrics>,
        apiClient.getBottlenecks() as Promise<Bottlenecks>,
        apiClient.getStats(),
        apiClient.getKnowledgeStats(),
      ]);

      // If aborted, bail out
      if (controller.signal.aborted) return;

      const metrics = results[0].status === "fulfilled" ? results[0].value : null;
      const bottlenecks = results[1].status === "fulfilled" ? results[1].value : null;
      const stats = results[2].status === "fulfilled" ? results[2].value : null;
      const knowledgeStats: KnowledgeStats =
        results[3].status === "fulfilled" ? results[3].value : { total: 0, bySource: {} };

      if (!metrics || !bottlenecks || !stats) {
        setError("Failed to load one or more insight endpoints");
        return;
      }

      const healthScore = computeHealthScore({
        completionRate: metrics.completionRate,
        totalNodes: stats.totalNodes,
        blockedCount: stats.byStatus.blocked ?? 0,
        missingACCount: bottlenecks.missingAcceptanceCriteria.length,
        oversizedCount: bottlenecks.oversizedTasks.length,
      });

      setData({ metrics, bottlenecks, stats, knowledgeStats, healthScore });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [load]);

  return { data, loading, error, refresh: load };
}
