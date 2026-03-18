import { Router } from "express";
import { readFile } from "node:fs/promises";
import { scanSkills } from "../../core/insights/skill-recommender.js";
import { getBuiltInSkills, getSkillsByPhase } from "../../core/skills/built-in-skills.js";
import { estimateTokens } from "../../core/context/token-estimator.js";
import type { LifecyclePhase } from "../../core/planner/lifecycle-phase.js";

interface SkillResponse {
  name: string;
  description: string;
  category: string;
  phases?: string[];
  source: "built-in" | "filesystem";
  estimatedTokens: number;
  filePath?: string;
}

export function createSkillsRouter(getBasePath: () => string): Router {
  const router = Router();

  /**
   * GET /skills — list all skills (built-in + filesystem).
   * Query params: ?phase=IMPLEMENT — filter by lifecycle phase.
   * ?source=built-in|filesystem — filter by source.
   */
  router.get("/", async (req, res, next) => {
    try {
      const phaseFilter = req.query.phase as string | undefined;
      const sourceFilter = req.query.source as string | undefined;

      const result: SkillResponse[] = [];

      // Built-in skills
      if (!sourceFilter || sourceFilter === "built-in") {
        const builtIn = phaseFilter
          ? getSkillsByPhase(phaseFilter as LifecyclePhase)
          : getBuiltInSkills();

        for (const skill of builtIn) {
          result.push({
            name: skill.name,
            description: skill.description,
            category: skill.category,
            phases: [...skill.phases],
            source: "built-in",
            estimatedTokens: estimateTokens(skill.instructions),
          });
        }
      }

      // Filesystem skills
      if (!sourceFilter || sourceFilter === "filesystem") {
        const fsSkills = await scanSkills(getBasePath());
        const builtInNames = new Set(getBuiltInSkills().map((s) => s.name));

        for (const skill of fsSkills) {
          if (builtInNames.has(skill.name)) continue;

          if (phaseFilter) continue; // filesystem skills have no phase metadata

          let tokens = 0;
          try {
            const content = await readFile(skill.filePath, "utf-8");
            tokens = estimateTokens(content);
          } catch {
            // file unreadable — default to 0
          }

          result.push({
            name: skill.name,
            description: skill.description,
            category: skill.category,
            source: "filesystem",
            estimatedTokens: tokens,
            filePath: skill.filePath,
          });
        }
      }

      const totalTokens = result.reduce((sum, s) => sum + s.estimatedTokens, 0);
      res.json({ skills: result, totalTokens });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
