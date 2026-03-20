/**
 * @deprecated Use `node` tool with action:"delete" instead. Will be removed in v7.0.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerDeleteNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "delete_node",
    "Delete a node and all its associated edges (DEPRECATED — use `node` with action:\"delete\")",
    { id: z.string().describe("The node ID to delete") },
    async ({ id }) => {
      logger.warn("tool:delete_node:deprecated", { message: "Use 'node' tool with action:'delete' instead" });
      logger.debug("tool:delete_node", { id });
      const deleted = store.deleteNode(id);

      if (!deleted) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:delete_node:fail", { error: err.message });
        return mcpError(err);
      }

      logger.info("tool:delete_node:ok", { id });
      return mcpText({ ok: true, deletedId: id, _deprecated: "Use 'node' tool with action:'delete'" });
    },
  );
}
