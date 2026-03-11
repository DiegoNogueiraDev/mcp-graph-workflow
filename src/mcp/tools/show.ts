import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

export function registerShow(server: McpServer, store: SqliteStore): void {
  server.tool(
    "show",
    "Show detailed information about a specific node, including its edges and children",
    { id: z.string().describe("The node ID to inspect") },
    async ({ id }) => {
      logger.debug("tool:show", { id });
      const node = store.getNodeById(id);
      if (!node) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:show:fail", { error: err.message });
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

      logger.info("tool:show:ok", { id, edgesOut: edgesFrom.length, edgesIn: edgesTo.length, children: children.length });
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
