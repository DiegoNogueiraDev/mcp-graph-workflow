import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { NodeStatus } from "../../core/graph/graph-types.js";
import { NodeStatusSchema } from "../../schemas/node.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

export function registerUpdateStatus(server: McpServer, store: SqliteStore): void {
  server.tool(
    "update_status",
    "Update the status of a node",
    {
      id: z.string().describe("The node ID to update"),
      status: NodeStatusSchema.describe("The new status"),
    },
    async ({ id, status }) => {
      logger.debug("tool:update_status", { id, status });
      const updated = store.updateNodeStatus(id, status as NodeStatus);

      if (!updated) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:update_status:fail", { error: err.message });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: err.message }) },
          ],
          isError: true,
        };
      }

      logger.info("tool:update_status:ok", { id, status });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, node: updated }, null, 2),
          },
        ],
      };
    },
  );
}
