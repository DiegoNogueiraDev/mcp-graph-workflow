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
import { CustomSkillInputSchema } from "../../schemas/skill.schema.js";
import { logger } from "../../core/utils/logger.js";

export function registerManageSkill(server: McpServer, store: SqliteStore): void {
  server.tool(
    "manage_skill",
    "Manage skills: enable/disable built-in skills, CRUD custom skills (know-me, project-specific).",
    {
      action: z
        .enum(["enable", "disable", "create", "update", "delete", "list_custom", "get_preferences"])
        .describe("Action to perform"),
      skillName: z
        .string()
        .optional()
        .describe("Skill name (for enable/disable/delete_by_name)"),
      skillId: z
        .string()
        .optional()
        .describe("Skill ID (for update/delete)"),
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
    async ({ action, skillName, skillId, data }) => {
      logger.debug("tool:manage_skill", { action, skillName, skillId });

      const project = store.getProject();
      if (!project) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "No active project. Run init first." }) }],
          isError: true,
        };
      }

      const db = store.getDb();
      const projectId = project.id;

      try {
        switch (action) {
          case "enable":
          case "disable": {
            if (!skillName) {
              return {
                content: [{ type: "text" as const, text: JSON.stringify({ error: "skillName required for enable/disable" }) }],
                isError: true,
              };
            }
            setSkillEnabled(db, projectId, skillName, action === "enable");
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ ok: true, skillName, enabled: action === "enable" }) }],
            };
          }

          case "create": {
            if (!data) {
              return {
                content: [{ type: "text" as const, text: JSON.stringify({ error: "data required for create" }) }],
                isError: true,
              };
            }
            const parsed = CustomSkillInputSchema.safeParse(data);
            if (!parsed.success) {
              return {
                content: [{ type: "text" as const, text: JSON.stringify({ error: "Validation failed", details: parsed.error.issues }) }],
                isError: true,
              };
            }
            const created = createCustomSkill(db, projectId, parsed.data);
            logger.info("tool:manage_skill:created", { id: created.id, name: created.name });
            return {
              content: [{ type: "text" as const, text: JSON.stringify(created, null, 2) }],
            };
          }

          case "update": {
            if (!skillId || !data) {
              return {
                content: [{ type: "text" as const, text: JSON.stringify({ error: "skillId and data required for update" }) }],
                isError: true,
              };
            }
            const updated = updateCustomSkill(db, projectId, skillId, data as Record<string, unknown>);
            return {
              content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
            };
          }

          case "delete": {
            if (!skillId && !skillName) {
              return {
                content: [{ type: "text" as const, text: JSON.stringify({ error: "skillId or skillName required for delete" }) }],
                isError: true,
              };
            }
            if (skillId) {
              deleteCustomSkill(db, projectId, skillId);
            } else if (skillName) {
              const skill = getCustomSkillByName(db, projectId, skillName);
              if (!skill) {
                return {
                  content: [{ type: "text" as const, text: JSON.stringify({ error: `Custom skill '${skillName}' not found` }) }],
                  isError: true,
                };
              }
              deleteCustomSkill(db, projectId, skill.id);
            }
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ ok: true, deleted: skillId ?? skillName }) }],
            };
          }

          case "list_custom": {
            const customs = getCustomSkills(db, projectId);
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({ total: customs.length, skills: customs }, null, 2),
              }],
            };
          }

          case "get_preferences": {
            const prefs = getSkillPreferences(db, projectId);
            const obj: Record<string, boolean> = {};
            for (const [k, v] of prefs) obj[k] = v;
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ preferences: obj }, null, 2) }],
            };
          }

          default:
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown action: ${action as string}` }) }],
              isError: true,
            };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("tool:manage_skill:error", { action, error: message });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );
}
