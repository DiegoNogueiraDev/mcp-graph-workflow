/**
 * Hook for fetching and managing Siebel objects + templates data.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

export interface SiebelObject {
  title: string;
  sourceType: string;
  siebelType?: string;
  siebelProject?: string;
  contentPreview: string;
}

export interface SifTemplate {
  type: string;
  xmlTag: string;
  requiredAttrs: string[];
  optionalAttrs: string[];
  childTags: string[];
}

interface UseSiebelDataReturn {
  objects: SiebelObject[];
  templates: SifTemplate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSiebelData(): UseSiebelDataReturn {
  const [objects, setObjects] = useState<SiebelObject[]>([]);
  const [templates, setTemplates] = useState<SifTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [objResult, tmplResult] = await Promise.all([
        apiClient.siebelGetObjects({ limit: 100 }).catch(() => ({ objects: [] as SiebelObject[], total: 0 })),
        apiClient.siebelGetTemplates().catch(() => ({ templates: [] as SifTemplate[] })),
      ]);
      setObjects(objResult.objects);
      setTemplates(tmplResult.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Siebel data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { objects, templates, loading, error, refresh };
}
