import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";

// ── In-memory cache with TTL ──────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function createLspCache(): {
  get: <T>(key: string) => T | undefined;
  set: <T>(key: string, data: T) => void;
} {
  const store = new Map<string, CacheEntry<unknown>>();

  return {
    get<T>(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        store.delete(key);
        return undefined;
      }
      return entry.data as T;
    },
    set<T>(key: string, data: T): void {
      store.set(key, { data, timestamp: Date.now() });
      // Evict old entries when cache grows too large
      if (store.size > 200) {
        const now = Date.now();
        for (const [k, v] of store) {
          if (now - v.timestamp > CACHE_TTL_MS) store.delete(k);
        }
      }
    },
  };
}

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

  // Client-side cache (persists across re-renders, shared within component lifecycle)
  const cacheRef = useRef(createLspCache());
  const cache = cacheRef.current;

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
    const cacheKey = `def:${file}:${line}:${character}`;
    const cached = cache.get<LspLocation[]>(cacheKey);
    if (cached) { setDefinitions(cached); return; }

    setOperationLoading(true);
    try {
      const data = await apiClient.lspDefinition(file, line, character);
      const result = data.definitions ?? [];
      cache.set(cacheKey, result);
      setDefinitions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Definition lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, [cache]);

  const findReferences = useCallback(async (file: string, line: number, character: number) => {
    type RefsResult = { total: number; refs: LspLocation[]; byFile: Record<string, number> };
    const cacheKey = `refs:${file}:${line}:${character}`;
    const cached = cache.get<RefsResult>(cacheKey);
    if (cached) { setReferences(cached); return; }

    setOperationLoading(true);
    try {
      const data = await apiClient.lspReferences(file, line, character);
      const result: RefsResult = { total: data.totalReferences ?? 0, refs: data.references ?? [], byFile: data.byFile ?? {} };
      cache.set(cacheKey, result);
      setReferences(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "References lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, [cache]);

  const getHover = useCallback(async (file: string, line: number, character: number) => {
    const cacheKey = `hover:${file}:${line}:${character}`;
    const cached = cache.get<LspHoverResult | null>(cacheKey);
    if (cached !== undefined) { setHover(cached); return; }

    setOperationLoading(true);
    try {
      const data = await apiClient.lspHover(file, line, character);
      const result = data.hover ?? null;
      cache.set(cacheKey, result);
      setHover(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hover lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, [cache]);

  const getDiagnostics = useCallback(async (file: string) => {
    const cacheKey = `diag:${file}`;
    const cached = cache.get<LspDiagnostic[]>(cacheKey);
    if (cached) { setDiagnostics(cached); return; }

    setOperationLoading(true);
    try {
      const data = await apiClient.lspDiagnostics(file);
      const result = data.diagnostics ?? [];
      cache.set(cacheKey, result);
      setDiagnostics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnostics lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, [cache]);

  const getSymbols = useCallback(async (file: string) => {
    const cacheKey = `sym:${file}`;
    const cached = cache.get<LspDocumentSymbol[]>(cacheKey);
    if (cached) { setSymbols(cached); return; }

    setOperationLoading(true);
    try {
      const data = await apiClient.lspSymbols(file);
      const result = (data.symbols ?? []) as LspDocumentSymbol[];
      cache.set(cacheKey, result);
      setSymbols(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Symbols lookup failed");
    } finally {
      setOperationLoading(false);
    }
  }, [cache]);

  return {
    languages, status, loading, error, operationLoading,
    definitions, references, hover, diagnostics, symbols,
    refresh, goToDefinition, findReferences, getHover, getDiagnostics, getSymbols,
  };
}
