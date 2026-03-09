import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { GraphStats } from "@/lib/types";

interface UseStatsReturn {
  stats: GraphStats | null;
  refresh: () => Promise<void>;
}

export function useStats(): UseStatsReturn {
  const [stats, setStats] = useState<GraphStats | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.getStats();
      setStats(data);
    } catch {
      // silently fail — stats are non-critical
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, refresh };
}
