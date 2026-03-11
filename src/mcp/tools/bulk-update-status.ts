import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { NodeStatus } from "../../core/graph/graph-types.js";
import { NodeStatusSchema } from "../../schemas/node.schema.js";
import { logger } from "../../core/utils/logger.js";

export function registerBulkUpdateStatus(server: McpServer, store: SqliteStore): void {
  server.tool(
    "bulk_update_status",
    "Update the status of multiple nodes at once",
    {
      ids: z.array(z.string()).describe("Array of node IDs to update"),
      status: NodeStatusSchema.describe("The new status to set"),
    },
    async ({ ids, status }) => {
      logger.debug("tool:bulk_update_status", { count: ids.length, status });
      const result = store.bulkUpdateStatus(ids, status as NodeStatus);

      logger.info("tool:bulk_update_status:ok", { count: ids.length, status });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, ...result }, null, 2),
          },
        ],
      };
    },
  );
}
