/**
 * MCP Tool — list_skills
 * Lists built-in skills with optional phase filter.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBuiltInSkills, getSkillsByPhase, getSkillByName } from "../../core/skills/built-in-skills.js";
import type { LifecyclePhase } from "../../core/planner/lifecycle-phase.js";
import { logger } from "../../core/utils/logger.js";

export function registerListSkills(server: McpServer): void {
  server.tool(
    "list_skills",
    "List built-in skills (prompts/workflows) mapped to lifecycle phases. Filter by phase or get a specific skill by name.",
    {
      phase: z
        .enum(["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "LISTENING"])
        .optional()
        .describe("Filter skills by lifecycle phase"),
      name: z
        .string()
        .optional()
        .describe("Get a specific skill by name (returns full instructions)"),
    },
    async ({ phase, name }) => {
      logger.debug("tool:list_skills", { phase, name });

      // Single skill lookup with full instructions
      if (name) {
        const skill = getSkillByName(name);
        if (!skill) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: `Skill '${name}' not found` }, null, 2),
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              name: skill.name,
              description: skill.description,
              category: skill.category,
              phases: skill.phases,
              instructions: skill.instructions,
            }, null, 2),
          }],
        };
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

      logger.info("tool:list_skills:ok", { count: summary.length, phase: phase ?? "all" });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            total: summary.length,
            ...(phase ? { phase } : {}),
            skills: summary,
          }, null, 2),
        }],
      };
    },
  );
}
