import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { GraphDocument } from "@/lib/types";

interface UseGraphDataReturn {
  graph: GraphDocument | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGraphData(): UseGraphDataReturn {
  const [graph, setGraph] = useState<GraphDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getGraph();
      setGraph(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { graph, loading, error, refresh };
}
