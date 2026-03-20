/**
 * @deprecated Use `manage_skill` tool with action:"list" instead. Will be removed in v7.0.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBuiltInSkills, getSkillsByPhase, getSkillByName } from "../../core/skills/built-in-skills.js";
import type { LifecyclePhase } from "../../core/planner/lifecycle-phase.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerListSkills(server: McpServer): void {
  server.tool(
    "list_skills",
    "List built-in skills (DEPRECATED — use `manage_skill` with action:\"list\")",
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
      logger.warn("tool:list_skills:deprecated", { message: "Use 'manage_skill' tool with action:'list' instead" });
      logger.debug("tool:list_skills", { phase, name });

      // Single skill lookup with full instructions
      if (name) {
        const skill = getSkillByName(name);
        if (!skill) {
          return mcpError(`Skill '${name}' not found. Use 'manage_skill' tool with action:'list'`);
        }

        return mcpText({
          name: skill.name,
          description: skill.description,
          category: skill.category,
          phases: skill.phases,
          instructions: skill.instructions,
          _deprecated: "Use 'manage_skill' tool with action:'list'",
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

      logger.info("tool:list_skills:ok", { count: summary.length, phase: phase ?? "all" });
      return mcpText({
        total: summary.length,
        ...(phase ? { phase } : {}),
        skills: summary,
        _deprecated: "Use 'manage_skill' tool with action:'list'",
      });
    },
  );
}
