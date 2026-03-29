import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface ToolInfo {
  name: string;
  description: string;
  category: string;
  deprecated: boolean;
  sourceFile: string;
}

interface RouteInfo {
  routerName: string;
  mountPath: string;
  endpoints: Array<{ method: string; path: string }>;
  sourceFile: string;
}

interface DocEntry {
  slug: string;
  title: string;
  category: string;
}

interface DocsStats {
  tools: { active: number; deprecated: number };
  routes: { routers: number; endpoints: number };
  docs: number;
}

interface UseDocsResult {
  tools: ToolInfo[];
  routes: RouteInfo[];
  docs: DocEntry[];
  stats: DocsStats | null;
  loading: boolean;
  error: string | null;
  fetchDocContent: (category: string, slug: string) => Promise<string>;
  refresh: () => Promise<void>;
}

export function useDocs(): UseDocsResult {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [stats, setStats] = useState<DocsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [toolsRes, routesRes, docsRes, statsRes] = await Promise.all([
        apiClient.getDocsTools().catch(() => ({ tools: [] as ToolInfo[] })),
        apiClient.getDocsRoutes().catch(() => ({ routes: [] as RouteInfo[] })),
        apiClient.getDocsList().catch(() => ({ docs: [] as DocEntry[] })),
        apiClient.getDocsStats().catch(() => null),
      ]);

      setTools(toolsRes.tools);
      setRoutes(routesRes.routes);
      setDocs(docsRes.docs);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load docs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const fetchDocContent = useCallback(async (category: string, slug: string): Promise<string> => {
    const res = await apiClient.getDocContent(category, slug);
    return res.content;
  }, []);

  return { tools, routes, docs, stats, loading, error, fetchDocContent, refresh: loadData };
}
