import { Router } from "express";
import { scanSkills } from "../../core/insights/skill-recommender.js";
import { getBuiltInSkills, getSkillsByPhase } from "../../core/skills/built-in-skills.js";
import type { LifecyclePhase } from "../../core/planner/lifecycle-phase.js";

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

      const result: Array<{
        name: string;
        description: string;
        category: string;
        phases?: string[];
        source: "built-in" | "filesystem";
        filePath?: string;
      }> = [];

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

          result.push({
            name: skill.name,
            description: skill.description,
            category: skill.category,
            source: "filesystem",
            filePath: skill.filePath,
          });
        }
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
