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
    "Update the status of one or more nodes. Pass a single ID string or an array of IDs for bulk updates.",
    {
      id: z.union([z.string(), z.array(z.string())]).describe("Node ID (string) or array of node IDs for bulk update"),
      status: NodeStatusSchema.describe("The new status"),
    },
    async ({ id, status }) => {
      const ids = Array.isArray(id) ? id : [id];
      const isBulk = ids.length > 1;

      logger.debug("tool:update_status", { ids, status, bulk: isBulk });

      if (isBulk) {
        const result = store.bulkUpdateStatus(ids, status as NodeStatus);
        logger.info("tool:update_status:ok", { count: ids.length, status, updated: result.updated.length });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ok: true, ...result }, null, 2),
            },
          ],
        };
      }

      // Single node update
      const updated = store.updateNodeStatus(ids[0], status as NodeStatus);

      if (!updated) {
        const err = new NodeNotFoundError(ids[0]);
        logger.warn("tool:update_status:fail", { error: err.message });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: err.message }) },
          ],
          isError: true,
        };
      }

      logger.info("tool:update_status:ok", { id: ids[0], status });
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
