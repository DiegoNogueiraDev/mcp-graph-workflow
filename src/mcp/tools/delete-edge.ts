import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

export function registerDeleteEdge(server: McpServer, store: SqliteStore): void {
  server.tool(
    "delete_edge",
    "Delete an edge (relationship) from the graph",
    {
      id: z.string().describe("The edge ID to delete"),
    },
    async ({ id }) => {
      const deleted = store.deleteEdge(id);

      if (!deleted) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: `Edge not found: ${id}` }) },
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
