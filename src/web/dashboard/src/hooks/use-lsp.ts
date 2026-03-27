import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

// Types inline (avoid import cycle)
export interface LspDetectedLanguage {
  languageId: string;
  fileCount: number;
  confidence: number;
  detectedVia: string;
  configFile?: string;
  serverCommand?: string;
}

export interface LspLanguagesResponse {
  ok: boolean;
  detected: LspDetectedLanguage[];
  supportedLanguages: string[];
}

export interface LspStatusResponse {
  ok: boolean;
  bridgeInitialized: boolean;
  servers: Record<string, string>;
}

export interface LspLocation {
  file: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  hint?: string;
}

export interface LspDiagnostic {
  file: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  severity: number;
  message: string;
  code?: string;
  source?: string;
}

export interface LspDocumentSymbol {
  name: string;
  kind: string;
  file: string;
  startLine: number;
  endLine: number;
  children?: LspDocumentSymbol[];
}

export interface LspHoverResult {
  signature: string | null;
  documentation?: string;
  language?: string;
}

export function useLsp(): {
  languages: LspLanguagesResponse | null;
  status: LspStatusResponse | null;
  loading: boolean;
  error: string | null;
  operationLoading: boolean;
  definitions: LspLocation[];
  references: { total: number; refs: LspLocation[]; byFile: Record<string, number> } | null;
  hover: LspHoverResult | null;
  diagnostics: LspDiagnostic[];
  symbols: LspDocumentSymbol[];
  refresh: () => Promise<void>;
  goToDefinition: (file: string, line: number, character: number) => Promise<void>;
  findReferences: (file: string, line: number, character: number) => Promise<void>;
  getHover: (file: string, line: number, character: number) => Promise<void>;
  getDiagnostics: (file: string) => Promise<void>;
  getSymbols: (file: string) => Promise<void>;
} {
  const [languages, setLanguages] = useState<LspLanguagesResponse | null>(null);
  const [status, setStatus] = useState<LspStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Operation results
  const [definitions, setDefinitions] = useState<LspLocation[]>([]);
  const [references, setReferences] = useState<{ total: number; refs: LspLocation[]; byFile: Record<string, number> } | null>(null);
  const [hover, setHover] = useState<LspHoverResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<LspDiagnostic[]>([]);
  const [symbols, setSymbols] = useState<LspDocumentSymbol[]>([]);
  const [operationLoading, setOperationLoading] = useState(false);

  const fetchLanguages = useCallback(async () => {
    try {
      const data = await apiClient.getLspLanguages();
      setLanguages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load LSP languages");
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiClient.getLspStatus();
      setStatus(data);
    } catch {
      // Status endpoint may fail if LSP not initialized -- that's ok
      setStatus({ ok: true, bridgeInitialized: false, servers: {} });
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchLanguages(), fetchStatus()]);
    setLoading(false);
  }, [fetchLanguages, fetchStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goToDefinition = useCallback(async (file: string, line: number, character: number) => {
    setOperationLoading(true);
    try {
      const data = await apiClient.lspDefinition(file, line, character);
      setDefinitions(data.definitions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Definition lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, []);

  const findReferences = useCallback(async (file: string, line: number, character: number) => {
    setOperationLoading(true);
    try {
      const data = await apiClient.lspReferences(file, line, character);
      setReferences({ total: data.totalReferences ?? 0, refs: data.references ?? [], byFile: data.byFile ?? {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : "References lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, []);

  const getHover = useCallback(async (file: string, line: number, character: number) => {
    setOperationLoading(true);
    try {
      const data = await apiClient.lspHover(file, line, character);
      setHover(data.hover ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hover lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, []);

  const getDiagnostics = useCallback(async (file: string) => {
    setOperationLoading(true);
    try {
      const data = await apiClient.lspDiagnostics(file);
      setDiagnostics(data.diagnostics ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnostics lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, []);

  const getSymbols = useCallback(async (file: string) => {
    setOperationLoading(true);
    try {
      const data = await apiClient.lspSymbols(file);
      setSymbols((data.symbols ?? []) as LspDocumentSymbol[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Symbols lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, []);

  return {
    languages, status, loading, error, operationLoading,
    definitions, references, hover, diagnostics, symbols,
    refresh, goToDefinition, findReferences, getHover, getDiagnostics, getSymbols,
  };
}
