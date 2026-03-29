/**
 * useTranslationHistory — fetches and manages translation job history.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { TranslationJob, TranslationStats } from "@/lib/types";

export interface UseTranslationHistoryState {
  jobs: TranslationJob[];
  stats: TranslationStats | null;
  loading: boolean;
  error: string | null;
}

export interface UseTranslationHistoryActions {
  refresh: () => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
}

export function useTranslationHistory(): [UseTranslationHistoryState, UseTranslationHistoryActions] {
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, statsRes] = await Promise.all([
        apiClient.translationListJobs(),
        apiClient.translationStats(),
      ]);
      setJobs(jobsRes.jobs);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteJob = useCallback(async (id: string) => {
    try {
      await apiClient.translationDeleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      // Refresh stats after delete to keep counters in sync
      const statsRes = await apiClient.translationStats();
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return [{ jobs, stats, loading, error }, { refresh, deleteJob }];
}
