import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { findNextTask } from "../../core/planner/next-task.js";
import { logger } from "../../core/utils/logger.js";

export function registerNext(server: McpServer, store: SqliteStore): void {
  server.tool(
    "next",
    "Suggest the next best task to work on based on priority, dependencies, and size",
    {},
    async () => {
      logger.debug("tool:next", {});
      const doc = store.toGraphDocument();
      const result = findNextTask(doc);

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

      logger.info("tool:next:ok", { found: true, nodeId: result.node.id });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { node: result.node, reason: result.reason },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
