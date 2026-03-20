import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { NodeType, NodeStatus } from "../../core/graph/graph-types.js";
import { NodeTypeSchema, NodeStatusSchema } from "../../schemas/node.schema.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerList(server: McpServer, store: SqliteStore): void {
  server.tool(
    "list",
    "List graph nodes with optional type/status/sprint filters",
    {
      type: NodeTypeSchema.optional().describe("Filter by node type"),
      status: NodeStatusSchema.optional().describe("Filter by node status"),
      sprint: z.string().optional().describe("Filter by sprint name"),
      limit: z.number().min(1).max(500).optional().default(50).describe("Max nodes to return (1-500, default 50)"),
      offset: z.number().min(0).optional().default(0).describe("Number of nodes to skip (default 0)"),
    },
    async ({ type, status, sprint, limit: rawLimit, offset: rawOffset }) => {
      const limit = rawLimit ?? 50;
      const offset = rawOffset ?? 0;
      logger.debug("tool:list", { type, status, sprint, limit, offset });
      let nodes;

      if (type && status) {
        nodes = store
          .getNodesByType(type as NodeType)
          .filter((n) => n.status === status);
      } else if (type) {
        nodes = store.getNodesByType(type as NodeType);
      } else if (status) {
        nodes = store.getNodesByStatus(status as NodeStatus);
      } else {
        nodes = store.getAllNodes();
      }

      // Apply sprint filter
      if (sprint) {
        nodes = nodes.filter((n) => n.sprint === sprint);
      }

      // Sort: priority ASC, then createdAt ASC
      nodes.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.createdAt.localeCompare(b.createdAt);
      });

      const total = nodes.length;
      const paginatedNodes = nodes.slice(offset, offset + limit);

      const summary = paginatedNodes.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        status: n.status,
        priority: n.priority,
        sprint: n.sprint ?? null,
        parentId: n.parentId ?? null,
      }));

      logger.info("tool:list:ok", { total, limit, offset, returned: paginatedNodes.length });
      return mcpText({ total, limit, offset, hasMore: offset + limit < total, nodes: summary });
    },
  );
}
