import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { NodeType, NodeStatus } from "../../core/graph/graph-types.js";
import { NodeTypeSchema, NodeStatusSchema } from "../../schemas/node.schema.js";

export function registerList(server: McpServer, store: SqliteStore): void {
  server.tool(
    "list",
    "List graph nodes with optional type/status/sprint filters",
    {
      type: NodeTypeSchema.optional().describe("Filter by node type"),
      status: NodeStatusSchema.optional().describe("Filter by node status"),
      sprint: z.string().optional().describe("Filter by sprint name"),
    },
    async ({ type, status, sprint }) => {
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

      const summary = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        status: n.status,
        priority: n.priority,
        sprint: n.sprint ?? null,
        parentId: n.parentId ?? null,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ total: nodes.length, nodes: summary }, null, 2),
          },
        ],
      };
    },
  );
}
