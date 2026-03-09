import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";

export function registerShow(server: McpServer, store: SqliteStore): void {
  server.tool(
    "show",
    "Show detailed information about a specific node, including its edges and children",
    { id: z.string().describe("The node ID to inspect") },
    async ({ id }) => {
      const node = store.getNodeById(id);
      if (!node) {
        const err = new NodeNotFoundError(id);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: err.message }) },
          ],
          isError: true,
        };
      }

      const edgesFrom = store.getEdgesFrom(id);
      const edgesTo = store.getEdgesTo(id);
      const children = store.getChildNodes(id);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                node,
                outgoingEdges: edgesFrom,
                incomingEdges: edgesTo,
                children: children.map((c) => ({
                  id: c.id,
                  type: c.type,
                  title: c.title,
                  status: c.status,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
