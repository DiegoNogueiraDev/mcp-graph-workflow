import { Router } from "express";
import { readFile } from "node:fs/promises";
import { scanSkills } from "../../core/insights/skill-recommender.js";
import { getBuiltInSkills, getSkillsByPhase } from "../../core/skills/built-in-skills.js";
import { estimateTokens } from "../../core/context/token-estimator.js";
import {
  setSkillEnabled,
  getSkillPreferences,
  createCustomSkill,
  updateCustomSkill,
  deleteCustomSkill,
  getCustomSkills,
} from "../../core/skills/skill-store.js";
import { CustomSkillInputSchema } from "../../schemas/skill.schema.js";
import type { LifecyclePhase } from "../../core/planner/lifecycle-phase.js";
import { logger } from "../../core/utils/logger.js";
import type { StoreRef } from "../../core/store/store-manager.js";

interface SkillResponse {
  name: string;
  description: string;
  category: string;
  phases?: string[];
  source: "built-in" | "filesystem" | "custom";
  estimatedTokens: number;
  filePath?: string;
  enabled: boolean;
  id?: string;
}

export function createSkillsRouter(getBasePath: () => string, storeRef?: StoreRef): Router {
  const router = Router();

  /** Helper: get project ID + DB from storeRef */
  function getProjectContext(): { db: import("better-sqlite3").Database; projectId: string } | null {
    if (!storeRef) return null;
    try {
      const project = storeRef.current.getProject();
      if (!project) return null;
      return { db: storeRef.current.getDb(), projectId: project.id };
    } catch (err) {
      logger.debug("skills:getProjectContextFailure", { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  /**
   * GET /skills — list all skills (built-in + filesystem + custom).
   * Query params: ?phase=IMPLEMENT — filter by lifecycle phase.
   * ?source=built-in|filesystem|custom — filter by source.
   */
  router.get("/", async (req, res, next) => {
    try {
      const phaseFilter = req.query.phase as string | undefined;
      const sourceFilter = req.query.source as string | undefined;

      const ctx = getProjectContext();
      const preferences = ctx ? getSkillPreferences(ctx.db, ctx.projectId) : new Map<string, boolean>();

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
            enabled: preferences.get(skill.name) ?? true,
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
          } catch (err) {
            logger.debug("skills:fileUnreadable", { error: err instanceof Error ? err.message : String(err) });
            // file unreadable — default to 0
          }

          result.push({
            name: skill.name,
            description: skill.description,
            category: skill.category,
            source: "filesystem",
            estimatedTokens: tokens,
            filePath: skill.filePath,
            enabled: preferences.get(skill.name) ?? true,
          });
        }
      }

      // Custom skills
      if (ctx && (!sourceFilter || sourceFilter === "custom")) {
        const customSkills = getCustomSkills(ctx.db, ctx.projectId);
        for (const skill of customSkills) {
          if (phaseFilter && !skill.phases.includes(phaseFilter as LifecyclePhase)) continue;

          result.push({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            category: skill.category,
            phases: [...skill.phases],
            source: "custom",
            estimatedTokens: estimateTokens(skill.instructions),
            enabled: preferences.get(skill.name) ?? true,
          });
        }
      }

      const totalTokens = result.reduce((sum, s) => sum + s.estimatedTokens, 0);
      res.json({ skills: result, totalTokens });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /skills/preferences — all skill preferences for active project.
   */
  router.get("/preferences", (req, res, next) => {
    try {
      const ctx = getProjectContext();
      if (!ctx) {
        res.json({ preferences: {} });
        return;
      }
      const prefs = getSkillPreferences(ctx.db, ctx.projectId);
      const obj: Record<string, boolean> = {};
      for (const [k, v] of prefs) obj[k] = v;
      res.json({ preferences: obj });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /skills/:name/preference — set enabled/disabled for a skill.
   */
  router.patch("/:name/preference", (req, res, next) => {
    try {
      const ctx = getProjectContext();
      if (!ctx) {
        res.status(400).json({ error: "No active project" });
        return;
      }
      const { enabled } = req.body as { enabled: boolean };
      if (typeof enabled !== "boolean") {
        res.status(400).json({ error: "Missing or invalid 'enabled' boolean field" });
        return;
      }
      setSkillEnabled(ctx.db, ctx.projectId, req.params.name, enabled);
      res.json({ ok: true, name: req.params.name, enabled });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /skills/custom — create a custom skill.
   */
  router.post("/custom", (req, res, next) => {
    try {
      const ctx = getProjectContext();
      if (!ctx) {
        res.status(400).json({ error: "No active project" });
        return;
      }
      const parsed = CustomSkillInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }
      const skill = createCustomSkill(ctx.db, ctx.projectId, parsed.data);
      res.status(201).json(skill);
    } catch (err) {
      next(err);
    }
  });

  /**
   * PUT /skills/custom/:id — update a custom skill.
   */
  router.put("/custom/:id", (req, res, next) => {
    try {
      const ctx = getProjectContext();
      if (!ctx) {
        res.status(400).json({ error: "No active project" });
        return;
      }
      const skill = updateCustomSkill(ctx.db, ctx.projectId, req.params.id, req.body);
      res.json(skill);
    } catch (err) {
      next(err);
    }
  });

  /**
   * DELETE /skills/custom/:id — delete a custom skill.
   */
  router.delete("/custom/:id", (req, res, next) => {
    try {
      const ctx = getProjectContext();
      if (!ctx) {
        res.status(400).json({ error: "No active project" });
        return;
      }
      deleteCustomSkill(ctx.db, ctx.projectId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
