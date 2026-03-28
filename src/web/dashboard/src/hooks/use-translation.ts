/**
 * useTranslation — 2-phase translation workflow hook.
 * Phase 1: analyze + prepare (creates job, returns prompt)
 * Phase 2: finalize (submit AI-generated code, get evidence)
 */

import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  TranslationAnalysis,
  TranslationPrepareResult,
  TranslationFinalizeResult,
  TranslationScope,
} from "@/lib/types";

type TranslationPhase = "idle" | "analyzing" | "prepared" | "finalizing" | "done" | "error";

export interface UseTranslationState {
  phase: TranslationPhase;
  analysis: TranslationAnalysis | null;
  prepareResult: TranslationPrepareResult | null;
  finalizeResult: TranslationFinalizeResult | null;
  error: string | null;
  loading: boolean;
}

export interface UseTranslationActions {
  analyze: (code: string, targetLanguage: string, scope?: TranslationScope) => Promise<void>;
  finalize: (generatedCode: string) => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: UseTranslationState = {
  phase: "idle",
  analysis: null,
  prepareResult: null,
  finalizeResult: null,
  error: null,
  loading: false,
};

export function useTranslation(): [UseTranslationState, UseTranslationActions] {
  const [state, setState] = useState<UseTranslationState>(INITIAL_STATE);

  const analyze = useCallback(async (code: string, targetLanguage: string, scope: TranslationScope = "snippet") => {
    setState((s) => ({ ...s, phase: "analyzing", loading: true, error: null }));
    try {
      const prepareResult = await apiClient.translationCreateJob(code, targetLanguage, scope);
      setState({
        phase: "prepared",
        analysis: prepareResult.analysis,
        prepareResult,
        finalizeResult: null,
        error: null,
        loading: false,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Analysis failed",
        loading: false,
      }));
    }
  }, []);

  const finalize = useCallback(async (generatedCode: string) => {
    const jobId = state.prepareResult?.jobId;
    if (!jobId) {
      setState((s) => ({ ...s, phase: "error", error: "No active job to finalize" }));
      return;
    }

    setState((s) => ({ ...s, phase: "finalizing", loading: true, error: null }));
    try {
      const finalizeResult = await apiClient.translationFinalize(jobId, generatedCode);
      setState((s) => ({
        ...s,
        phase: "done",
        finalizeResult,
        loading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Finalize failed",
        loading: false,
      }));
    }
  }, [state.prepareResult?.jobId]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return [state, { analyze, finalize, reset }];
}
