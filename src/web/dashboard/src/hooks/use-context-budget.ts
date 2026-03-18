import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { ContextBudget } from "@/lib/types";

export interface UseContextBudgetReturn {
  budget: ContextBudget | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useContextBudget(): UseContextBudgetReturn {
  const [budget, setBudget] = useState<ContextBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getContextBudget();
      setBudget(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context budget");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { budget, loading, error, refresh: load };
}
