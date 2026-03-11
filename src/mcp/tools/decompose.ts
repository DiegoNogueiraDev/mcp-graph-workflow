import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { detectLargeTasks } from "../../core/planner/decompose.js";
import { logger } from "../../core/utils/logger.js";

export function registerDecompose(server: McpServer, store: SqliteStore): void {
  server.tool(
    "decompose",
    "Detect large tasks that should be decomposed into subtasks",
    {
      nodeId: z.string().optional().describe("Filter results to a specific node ID"),
    },
    async ({ nodeId }) => {
      logger.debug("tool:decompose", { nodeId });
      const doc = store.toGraphDocument();
      let results = detectLargeTasks(doc);

      if (nodeId) {
        results = results.filter((r) => r.node.id === nodeId);
      }

      logger.info("tool:decompose:ok", { count: results.length });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, results }, null, 2),
          },
        ],
      };
    },
  );
}
