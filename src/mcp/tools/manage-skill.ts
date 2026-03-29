/**
 * MCP Tool — manage_skill
 * Enable/disable skills and CRUD custom skills via agent.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  setSkillEnabled,
  getSkillPreferences,
  createCustomSkill,
  updateCustomSkill,
  deleteCustomSkill,
  getCustomSkills,
  getCustomSkillByName,
} from "../../core/skills/skill-store.js";
import { getBuiltInSkills, getSkillsByPhase, getSkillByName } from "../../core/skills/built-in-skills.js";
import type { LifecyclePhase } from "../../core/planner/lifecycle-phase.js";
import { CustomSkillInputSchema } from "../../schemas/skill.schema.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";
import { indexEntitiesForSource } from "../../core/rag/entity-index-hook.js";

export function registerManageSkill(server: McpServer, store: SqliteStore): void {
  server.tool(
    "manage_skill",
    "Manage skills: list built-in skills, enable/disable, CRUD custom skills.",
    {
      action: z
        .enum(["list", "enable", "disable", "create", "update", "delete", "list_custom", "get_preferences"])
        .describe("Action to perform"),
      skillName: z
        .string()
        .optional()
        .describe("Skill name (for list: get full instructions; enable/disable/delete_by_name)"),
      skillId: z
        .string()
        .optional()
        .describe("Skill ID (for update/delete)"),
      phase: z
        .enum(["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING"])
        .optional()
        .describe("Filter skills by lifecycle phase (list only)"),
      data: z
        .object({
          name: z.string().optional(),
          description: z.string().optional(),
          category: z.string().optional(),
          phases: z.array(z.string()).optional(),
          instructions: z.string().optional(),
        })
        .optional()
        .describe("Skill data (for create/update)"),
    },
    async ({ action, skillName, skillId, phase, data }) => {
      logger.debug("tool:manage_skill", { action, skillName, skillId });

      const project = store.getProject();
      if (!project) {
        return mcpError("No active project. Run init first.");
      }

      const db = store.getDb();
      const projectId = project.id;

      try {
        switch (action) {
          case "list": {
            // Single skill lookup with full instructions
            if (skillName) {
              const skill = getSkillByName(skillName);
              if (!skill) {
                return mcpError(`Skill '${skillName}' not found`);
              }

              return mcpText({
                name: skill.name,
                description: skill.description,
                category: skill.category,
                phases: skill.phases,
                instructions: skill.instructions,
              });
            }

            // List skills (optionally filtered by phase)
            const skills = phase
              ? getSkillsByPhase(phase as LifecyclePhase)
              : getBuiltInSkills();

            const summary = skills.map((s) => ({
              name: s.name,
              description: s.description,
              category: s.category,
              phases: s.phases,
            }));

            logger.info("tool:manage_skill:list:ok", { count: summary.length, phase: phase ?? "all" });
            return mcpText({
              total: summary.length,
              ...(phase ? { phase } : {}),
              skills: summary,
            });
          }

          case "enable":
          case "disable": {
            if (!skillName) {
              return mcpError("skillName required for enable/disable");
            }
            // Bug #017: validate skill exists before enabling
            const builtIn = getSkillByName(skillName);
            const custom = getCustomSkillByName(db, projectId, skillName);
            if (!builtIn && !custom) {
              return mcpError(`Skill '${skillName}' not found (neither built-in nor custom)`);
            }
            setSkillEnabled(db, projectId, skillName, action === "enable");
            return mcpText({ ok: true, skillName, enabled: action === "enable" });
          }

          case "create": {
            if (!data) {
              return mcpError("data required for create");
            }
            const parsed = CustomSkillInputSchema.safeParse(data);
            if (!parsed.success) {
              return mcpError(`Validation failed: ${JSON.stringify(parsed.error.issues)}`);
            }
            const created = createCustomSkill(db, projectId, parsed.data);
            indexEntitiesForSource(db, "skill");
            logger.info("tool:manage_skill:created", { id: created.id, name: created.name });
            return mcpText(created);
          }

          case "update": {
            if (!skillId || !data) {
              return mcpError("skillId and data required for update");
            }
            const updated = updateCustomSkill(db, projectId, skillId, data as Record<string, unknown>);
            indexEntitiesForSource(db, "skill");
            return mcpText(updated);
          }

          case "delete": {
            if (!skillId && !skillName) {
              return mcpError("skillId or skillName required for delete");
            }
            if (skillId) {
              deleteCustomSkill(db, projectId, skillId);
            } else if (skillName) {
              const skill = getCustomSkillByName(db, projectId, skillName);
              if (!skill) {
                return mcpError(`Custom skill '${skillName}' not found`);
              }
              deleteCustomSkill(db, projectId, skill.id);
            }
            return mcpText({ ok: true, deleted: skillId ?? skillName });
          }

          case "list_custom": {
            const customs = getCustomSkills(db, projectId);
            return mcpText({ total: customs.length, skills: customs });
          }

          case "get_preferences": {
            const prefs = getSkillPreferences(db, projectId);
            const obj: Record<string, boolean> = {};
            for (const [k, v] of prefs) obj[k] = v;
            return mcpText({ preferences: obj });
          }

          default:
            return mcpError(`Unknown action: ${action as string}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("tool:manage_skill:error", { action, error: message });
        return mcpError(message);
      }
    },
  );
}
