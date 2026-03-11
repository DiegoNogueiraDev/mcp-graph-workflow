import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { generatePlanningReport } from "../../core/planner/planning-report.js";
import { findEnhancedNextTask } from "../../core/planner/enhanced-next.js";
import { logger } from "../../core/utils/logger.js";

export function registerPlanSprint(server: McpServer, store: SqliteStore): void {
  server.tool(
    "plan_sprint",
    "Generate a sprint planning report with recommended task order, missing docs, risk assessment, and velocity-based estimates.",
    {
      mode: z
        .enum(["report", "next"])
        .optional()
        .describe("Mode: 'report' for full planning report, 'next' for enhanced next task (default: report)"),
    },
    async ({ mode }) => {
      logger.debug("tool:plan_sprint", { mode: mode ?? "report" });
      const doc = store.toGraphDocument();

      if (mode === "next") {
        const result = findEnhancedNextTask(doc, store);

        if (!result) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ message: "No tasks available" }),
            }],
          };
        }

        logger.info("tool:plan_sprint:ok", { mode: "next", taskId: result.task.node.id });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              task: {
                id: result.task.node.id,
                title: result.task.node.title,
                type: result.task.node.type,
                priority: result.task.node.priority,
                xpSize: result.task.node.xpSize,
              },
              knowledgeCoverage: result.knowledgeCoverage,
              velocityContext: result.velocityContext,
              enhancedReason: result.enhancedReason,
            }, null, 2),
          }],
        };
      }

      // Default: full planning report
      const report = generatePlanningReport(doc, store);

      logger.info("tool:plan_sprint:ok", { mode: "report" });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(report, null, 2),
        }],
      };
    },
  );
}
