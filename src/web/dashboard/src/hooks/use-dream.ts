import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { DreamStatus, DreamCycleResult, DreamMetrics } from "@/lib/types";

export interface UseDreamReturn {
  status: DreamStatus | null;
  history: DreamCycleResult[];
  metrics: DreamMetrics | null;
  loading: boolean;
  error: string | null;
  startCycle: (config?: Record<string, unknown>) => Promise<void>;
  cancelCycle: () => Promise<void>;
  preview: () => Promise<DreamCycleResult | null>;
  refresh: () => void;
}

export function useDream(): UseDreamReturn {
  const [status, setStatus] = useState<DreamStatus | null>(null);
  const [history, setHistory] = useState<DreamCycleResult[]>([]);
  const [metrics, setMetrics] = useState<DreamMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, h, m] = await Promise.all([
        apiClient.dreamGetStatus(),
        apiClient.dreamGetHistory(20),
        apiClient.dreamGetMetrics(),
      ]);
      setStatus(s);
      setHistory(h);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dream data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCycle = useCallback(async (config?: Record<string, unknown>) => {
    try {
      await apiClient.dreamStartCycle(config);
      // Refresh after a short delay to pick up the running state
      setTimeout(() => void load(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start dream cycle");
    }
  }, [load]);

  const cancelCycle = useCallback(async () => {
    try {
      await apiClient.dreamCancelCycle();
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel dream cycle");
    }
  }, [load]);

  const preview = useCallback(async (): Promise<DreamCycleResult | null> => {
    try {
      return await apiClient.dreamGetPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get dream preview");
      return null;
    }
  }, []);

  return { status, history, metrics, loading, error, startCycle, cancelCycle, preview, refresh: load };
}
