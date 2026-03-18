import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { Skill, Recommendation, CustomSkillInput } from "@/lib/types";

export interface UseSkillsReturn {
  skills: Skill[];
  recommendations: Recommendation[];
  totalTokens: number;
  activeTokens: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  toggleSkill: (name: string, enabled: boolean) => Promise<void>;
  createSkill: (data: CustomSkillInput) => Promise<void>;
  updateSkill: (id: string, data: Partial<CustomSkillInput>) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
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

  const toggleSkill = useCallback(async (name: string, enabled: boolean) => {
    // Optimistic update
    setSkills((prev) => prev.map((s) => s.name === name ? { ...s, enabled } : s));
    try {
      await apiClient.toggleSkill(name, enabled);
    } catch {
      // Revert on failure
      void load();
    }
  }, [load]);

  const createSkill = useCallback(async (data: CustomSkillInput) => {
    await apiClient.createCustomSkill(data);
    void load();
  }, [load]);

  const updateSkill = useCallback(async (id: string, data: Partial<CustomSkillInput>) => {
    await apiClient.updateCustomSkill(id, data);
    void load();
  }, [load]);

  const deleteSkill = useCallback(async (id: string) => {
    await apiClient.deleteCustomSkill(id);
    void load();
  }, [load]);

  const activeTokens = skills
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + s.estimatedTokens, 0);

  return {
    skills,
    recommendations,
    totalTokens,
    activeTokens,
    loading,
    error,
    refresh: load,
    toggleSkill,
    createSkill,
    updateSkill,
    deleteSkill,
  };
}
