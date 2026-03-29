/**
 * useProjectTranslation — manages project translation lifecycle.
 * Upload ZIP → analyze → prepare → finalize per file → download
 */
import { useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  TranslationProject,
  TranslationProjectFile,
  TranslationProjectSummary,
} from "@/lib/types";

export type ProjectMode = "idle" | "uploading" | "analyzing" | "ready" | "error";

export interface UseProjectTranslationState {
  mode: ProjectMode;
  project: TranslationProject | null;
  files: TranslationProjectFile[];
  summary: TranslationProjectSummary | null;
  selectedFileId: string | null;
  error: string | null;
  loading: boolean;
}

export interface UseProjectTranslationActions {
  upload: (file: File, targetLanguage: string, name?: string) => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  selectFile: (fileId: string | null) => void;
  prepareFiles: (fileIds?: string[]) => Promise<void>;
  finalizeFile: (fileId: string, generatedCode: string) => Promise<void>;
  downloadProject: () => Promise<void>;
  downloadFile: (fileId: string) => Promise<void>;
  refreshSummary: () => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: UseProjectTranslationState = {
  mode: "idle",
  project: null,
  files: [],
  summary: null,
  selectedFileId: null,
  error: null,
  loading: false,
};

export function useProjectTranslation(): [UseProjectTranslationState, UseProjectTranslationActions] {
  const [state, setState] = useState<UseProjectTranslationState>(INITIAL_STATE);
  const projectIdRef = useRef<string | null>(null);

  const upload = useCallback(async (file: File, targetLanguage: string, name?: string) => {
    setState((s) => ({ ...s, mode: "uploading", loading: true, error: null }));
    try {
      const result = await apiClient.translationUploadProject(file, targetLanguage, name);
      projectIdRef.current = result.project.id;
      setState({
        mode: "ready",
        project: result.project,
        files: result.files,
        summary: null,
        selectedFileId: null,
        error: null,
        loading: false,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        mode: "error",
        error: err instanceof Error ? err.message : "Upload failed",
        loading: false,
      }));
    }
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await apiClient.translationGetProject(projectId);
      projectIdRef.current = result.project.id;
      setState({
        mode: "ready",
        project: result.project,
        files: result.files,
        summary: null,
        selectedFileId: null,
        error: null,
        loading: false,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        mode: "error",
        error: err instanceof Error ? err.message : "Failed to load project",
        loading: false,
      }));
    }
  }, []);

  const selectFile = useCallback((fileId: string | null) => {
    setState((s) => ({ ...s, selectedFileId: fileId }));
  }, []);

  const prepareFiles = useCallback(async (fileIds?: string[]) => {
    const pid = projectIdRef.current;
    if (!pid) {
      setState((s) => ({ ...s, mode: "error", error: "No active project" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await apiClient.translationPrepareFiles(pid, fileIds);
      const refreshed = await apiClient.translationGetProject(pid);
      setState((s) => ({
        ...s,
        project: refreshed.project,
        files: refreshed.files,
        loading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Prepare failed",
        loading: false,
      }));
    }
  }, []);

  const finalizeFile = useCallback(async (fileId: string, generatedCode: string) => {
    const pid = projectIdRef.current;
    if (!pid) {
      setState((s) => ({ ...s, mode: "error", error: "No active project" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await apiClient.translationFinalizeFile(pid, fileId, generatedCode);
      const refreshed = await apiClient.translationGetProject(pid);
      setState((s) => ({
        ...s,
        project: refreshed.project,
        files: refreshed.files,
        loading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Finalize failed",
        loading: false,
      }));
    }
  }, []);

  const downloadProject = useCallback(async () => {
    const pid = projectIdRef.current;
    if (!pid) {
      setState((s) => ({ ...s, mode: "error", error: "No active project" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const blob = await apiClient.translationDownloadProject(pid);
      const filename = state.project?.name
        ? `${state.project.name}-translated.zip`
        : "translated-project.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setState((s) => ({ ...s, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Download failed",
        loading: false,
      }));
    }
  }, [state.project?.name]);

  const downloadFile = useCallback(async (fileId: string) => {
    const pid = projectIdRef.current;
    if (!pid) {
      setState((s) => ({ ...s, mode: "error", error: "No active project" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const blob = await apiClient.translationDownloadFile(pid, fileId);
      const file = state.files.find((f) => f.id === fileId);
      const filename = file?.filePath
        ? file.filePath.split("/").pop() ?? "translated-file"
        : "translated-file";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setState((s) => ({ ...s, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "File download failed",
        loading: false,
      }));
    }
  }, [state.files]);

  const refreshSummary = useCallback(async () => {
    const pid = projectIdRef.current;
    if (!pid) {
      setState((s) => ({ ...s, mode: "error", error: "No active project" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const summary = await apiClient.translationProjectSummary(pid);
      setState((s) => ({ ...s, summary, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to refresh summary",
        loading: false,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    projectIdRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return [
    state,
    {
      upload,
      loadProject,
      selectFile,
      prepareFiles,
      finalizeFile,
      downloadProject,
      downloadFile,
      refreshSummary,
      reset,
    },
  ];
}
