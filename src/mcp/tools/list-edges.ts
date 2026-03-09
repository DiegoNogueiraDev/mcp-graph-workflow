import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { GraphEdge, RelationType } from "../../core/graph/graph-types.js";
import { RelationTypeSchema } from "../../schemas/edge.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";

export function registerListEdges(server: McpServer, store: SqliteStore): void {
  server.tool(
    "list_edges",
    "List and filter edges in the graph",
    {
      nodeId: z.string().optional().describe("Filter edges by node ID"),
      direction: z.enum(["from", "to", "both"]).optional().describe("Edge direction relative to nodeId (default: both)"),
      relationType: RelationTypeSchema.optional().describe("Filter by relationship type"),
    },
    async ({ nodeId, direction, relationType }) => {
      let edges: GraphEdge[];

      if (nodeId) {
        const node = store.getNodeById(nodeId);
        if (!node) {
          const err = new NodeNotFoundError(nodeId);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: err.message }) },
            ],
            isError: true,
          };
        }

        const dir = direction ?? "both";
        if (dir === "from") {
          edges = store.getEdgesFrom(nodeId);
        } else if (dir === "to") {
          edges = store.getEdgesTo(nodeId);
        } else {
          edges = [...store.getEdgesFrom(nodeId), ...store.getEdgesTo(nodeId)];
        }
      } else {
        edges = store.getAllEdges();
      }

      if (relationType) {
        edges = edges.filter((e) => e.relationType === (relationType as RelationType));
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ total: edges.length, edges }, null, 2),
          },
        ],
      };
    },
  );
}
