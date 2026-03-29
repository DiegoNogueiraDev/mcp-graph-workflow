/**
 * useTranslationKnowledge — fetch knowledge stats and search translation evidence.
 */
import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { TranslationKnowledgeStats } from "@/lib/types";

export interface TranslationSearchResult {
  id: string;
  title: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
  score?: number;
  createdAt: string;
}

export interface UseTranslationKnowledgeState {
  knowledge: TranslationKnowledgeStats | null;
  searchResults: TranslationSearchResult[];
  loading: boolean;
  error: string | null;
}

export interface UseTranslationKnowledgeActions {
  search: (query: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const INITIAL_STATE: UseTranslationKnowledgeState = {
  knowledge: null,
  searchResults: [],
  loading: false,
  error: null,
};

export function useTranslationKnowledge(): [UseTranslationKnowledgeState, UseTranslationKnowledgeActions] {
  const [state, setState] = useState<UseTranslationKnowledgeState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const knowledge = await apiClient.translationGetKnowledge();
      setState((s) => ({ ...s, knowledge, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to load knowledge stats",
        loading: false,
      }));
    }
  }, []);

  const search = useCallback(async (query: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await apiClient.translationSearchKnowledge(query);
      setState((s) => ({ ...s, searchResults: result.results, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Search failed",
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return [state, { search, refresh }];
}
