import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { Skill, Recommendation } from "@/lib/types";

export interface UseSkillsReturn {
  skills: Skill[];
  recommendations: Recommendation[];
  totalTokens: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSkills(): UseSkillsReturn {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [skillsRes, recsRes] = await Promise.all([
        apiClient.getSkills(),
        apiClient.getRecommendations().catch((): { recommendations: Recommendation[] } => ({ recommendations: [] })),
      ]);

      setSkills(skillsRes.skills);
      setTotalTokens(skillsRes.totalTokens);
      setRecommendations(recsRes.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { skills, recommendations, totalTokens, loading, error, refresh: load };
}
