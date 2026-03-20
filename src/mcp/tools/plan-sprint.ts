import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { generatePlanningReport } from "../../core/planner/planning-report.js";
import { findEnhancedNextTask } from "../../core/planner/enhanced-next.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

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
          return mcpText({ message: "No tasks available" });
        }

        logger.info("tool:plan_sprint:ok", { mode: "next", taskId: result.task.node.id });
        return mcpText({
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
        });
      }

      // Default: full planning report
      const report = generatePlanningReport(doc, store);

      // Index sprint plan into knowledge store for cross-phase RAG
      try {
        const knowledgeStore = new KnowledgeStore(store.getDb());
        const planText = JSON.stringify(report, null, 2);
        const sourceId = `sprint_plan:${new Date().toISOString()}`;
        knowledgeStore.insert({
          sourceType: "sprint_plan",
          sourceId,
          title: "Sprint Planning Report",
          content: planText.length > 2000 ? planText.slice(0, 2000) : planText,
          metadata: {
            phase: "PLAN",
            generatedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        logger.warn("tool:plan_sprint:knowledge_index_failed", { error: String(err) });
      }

      logger.info("tool:plan_sprint:ok", { mode: "report" });
      return mcpText(report);
    },
  );
}
