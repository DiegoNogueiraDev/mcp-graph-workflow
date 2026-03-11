import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

export function registerDeleteNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "delete_node",
    "Delete a node and all its associated edges from the graph",
    { id: z.string().describe("The node ID to delete") },
    async ({ id }) => {
      logger.debug("tool:delete_node", { id });
      const deleted = store.deleteNode(id);

      if (!deleted) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:delete_node:fail", { error: err.message });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: err.message }) },
          ],
          isError: true,
        };
      }

      logger.info("tool:delete_node:ok", { id });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, deletedId: id }, null, 2),
          },
        ],
      };
    },
  );
}
