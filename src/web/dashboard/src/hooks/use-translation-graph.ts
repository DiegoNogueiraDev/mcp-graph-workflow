/**
 * useTranslationGraph — fetch graph data for translation visualization.
 */
import { useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import type { TranslationGraphData } from "@/lib/types";

export interface UseTranslationGraphState {
  data: TranslationGraphData | null;
  loading: boolean;
  error: string | null;
}

export interface UseTranslationGraphActions {
  load: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const INITIAL_STATE: UseTranslationGraphState = {
  data: null,
  loading: false,
  error: null,
};

export function useTranslationGraph(): [UseTranslationGraphState, UseTranslationGraphActions] {
  const [state, setState] = useState<UseTranslationGraphState>(INITIAL_STATE);
  const projectIdRef = useRef<string | null>(null);

  const load = useCallback(async (projectId: string) => {
    projectIdRef.current = projectId;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiClient.translationProjectGraph(projectId);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to load graph data",
        loading: false,
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    const pid = projectIdRef.current;
    if (!pid) {
      setState((s) => ({ ...s, error: "No project loaded to refresh" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiClient.translationProjectGraph(pid);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to refresh graph data",
        loading: false,
      }));
    }
  }, []);

  return [state, { load, refresh }];
}
