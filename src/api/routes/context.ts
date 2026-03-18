import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { buildTaskContext } from "../../core/context/compact-context.js";
import { getBuiltInSkills } from "../../core/skills/built-in-skills.js";
import { getSkillPreferences, getCustomSkills } from "../../core/skills/skill-store.js";
import { estimateTokens } from "../../core/context/token-estimator.js";

export function createContextRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/preview", (req, res, next) => {
    try {
      const nodeId = req.query.nodeId as string | undefined;
      if (!nodeId) {
        res.status(400).json({ error: "Missing 'nodeId' query parameter" });
        return;
      }

      const context = buildTaskContext(storeRef.current, nodeId);
      if (!context) {
        res.status(404).json({ error: `Node not found: ${nodeId}` });
        return;
      }

      res.json(context);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /context/budget — token budget breakdown per skill.
   */
  router.get("/budget", (req, res, next) => {
    try {
      const project = storeRef.current.getProject();
      const db = storeRef.current.getDb();

      const preferences = project
        ? getSkillPreferences(db, project.id)
        : new Map<string, boolean>();

      const breakdown: Array<{
        name: string;
        source: "built-in" | "custom";
        tokens: number;
        enabled: boolean;
      }> = [];

      // Built-in skills
      for (const skill of getBuiltInSkills()) {
        const enabled = preferences.get(skill.name) ?? true;
        breakdown.push({
          name: skill.name,
          source: "built-in",
          tokens: estimateTokens(skill.instructions),
          enabled,
        });
      }

      // Custom skills
      if (project) {
        const customSkills = getCustomSkills(db, project.id);
        for (const skill of customSkills) {
          const enabled = preferences.get(skill.name) ?? true;
          breakdown.push({
            name: skill.name,
            source: "custom",
            tokens: estimateTokens(skill.instructions),
            enabled,
          });
        }
      }

      const totalTokens = breakdown.reduce((s, b) => s + b.tokens, 0);
      const activeTokens = breakdown.filter((b) => b.enabled).reduce((s, b) => s + b.tokens, 0);
      const activeCount = breakdown.filter((b) => b.enabled).length;
      const totalCount = breakdown.length;

      // Sort by token size descending
      breakdown.sort((a, b) => b.tokens - a.tokens);

      // Generate recommendations
      const recommendations: string[] = [];
      if (activeTokens > 4000) {
        recommendations.push("Active skill tokens exceed 4000. Consider disabling non-essential skills.");
      }
      const largeSoftwareDesign = breakdown.filter(
        (b) => b.enabled && b.source === "built-in" && b.tokens > 100,
      );
      if (largeSoftwareDesign.length > 20) {
        recommendations.push("Many large skills enabled. Review if all are needed for the current phase.");
      }

      // Session health: green / yellow / red
      const ratio = activeTokens / 4000;
      const health: "green" | "yellow" | "red" =
        ratio <= 0.5 ? "green" : ratio <= 0.8 ? "yellow" : "red";

      const healthMessages: Record<string, string> = {
        green: "Context budget is healthy.",
        yellow: "Consider disabling non-essential skills to save tokens.",
        red: "Token budget is high. Start a new session or disable skills to reduce context.",
      };

      res.json({
        totalTokens,
        activeTokens,
        totalCount,
        activeCount,
        health,
        healthMessage: healthMessages[health],
        recommendations,
        breakdown,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
