import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { calculateVelocity } from "../../core/planner/velocity.js";
import { logger } from "../../core/utils/logger.js";

export function registerVelocity(server: McpServer, store: SqliteStore): void {
  server.tool(
    "velocity",
    "Calculate sprint velocity metrics (tasks completed, points, avg completion time)",
    {
      sprint: z.string().optional().describe("Filter results to a specific sprint"),
    },
    async ({ sprint }) => {
      logger.debug("tool:velocity", { sprint });
      const doc = store.toGraphDocument();
      const summary = calculateVelocity(doc);

      if (sprint) {
        summary.sprints = summary.sprints.filter((s) => s.sprint === sprint);
      }

      logger.info("tool:velocity:ok", { sprintCount: summary.sprints.length });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, ...summary }, null, 2),
          },
        ],
      };
    },
  );
}
