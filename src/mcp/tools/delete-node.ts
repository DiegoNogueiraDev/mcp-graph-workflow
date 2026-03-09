import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";

export function registerDeleteNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "delete_node",
    "Delete a node and all its associated edges from the graph",
    { id: z.string().describe("The node ID to delete") },
    async ({ id }) => {
      const deleted = store.deleteNode(id);

      if (!deleted) {
        const err = new NodeNotFoundError(id);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: err.message }) },
          ],
          isError: true,
        };
      }

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
