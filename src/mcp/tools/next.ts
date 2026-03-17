import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { findEnhancedNextTask } from "../../core/planner/enhanced-next.js";
import { generateTddHints } from "../../core/implementer/tdd-checker.js";
import { logger } from "../../core/utils/logger.js";

export function registerNext(server: McpServer, store: SqliteStore): void {
  server.tool(
    "next",
    "Suggest the next best task to work on based on priority, dependencies, size, knowledge coverage, and velocity. Includes TDD hints from acceptance criteria.",
    {},
    async () => {
      logger.debug("tool:next", {});
      const doc = store.toGraphDocument();
      const result = findEnhancedNextTask(doc, store);

      if (!result) {
        logger.info("tool:next:ok", { found: false });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                message: "No actionable tasks found. All tasks are either done or blocked.",
              }),
            },
          ],
        };
      }

      const tddHints = generateTddHints(result.task.node);

      logger.info("tool:next:ok", {
        found: true,
        nodeId: result.task.node.id,
        knowledgeCoverage: result.knowledgeCoverage,
        tddHints: tddHints.length,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                node: result.task.node,
                reason: result.task.reason,
                knowledgeCoverage: result.knowledgeCoverage,
                velocityContext: result.velocityContext,
                enhancedReason: result.enhancedReason,
                tddHints,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
