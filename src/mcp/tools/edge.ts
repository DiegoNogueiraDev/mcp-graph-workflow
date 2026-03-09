import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { GraphEdge, RelationType } from "../../core/graph/graph-types.js";
import { RelationTypeSchema } from "../../schemas/edge.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";

export function registerEdge(server: McpServer, store: SqliteStore): void {
  server.tool(
    "edge",
    "Manage edges: add, delete, or list relationships between nodes",
    {
      action: z.enum(["add", "delete", "list"]).describe("Action to perform"),
      // add params
      from: z.string().optional().describe("Source node ID (required for add)"),
      to: z.string().optional().describe("Target node ID (required for add)"),
      relationType: RelationTypeSchema.optional().describe("Relationship type (required for add, optional filter for list)"),
      reason: z.string().optional().describe("Why this relationship exists (add only)"),
      weight: z.number().optional().describe("Edge weight 0-1 (add only)"),
      // delete params
      id: z.string().optional().describe("Edge ID (required for delete)"),
      // list params
      nodeId: z.string().optional().describe("Filter edges by node ID (list only)"),
      direction: z.enum(["from", "to", "both"]).optional().describe("Edge direction relative to nodeId (list only, default: both)"),
    },
    async ({ action, from, to, relationType, reason, weight, id, nodeId, direction }) => {
      if (action === "add") {
        if (!from || !to || !relationType) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "from, to, and relationType are required for add action" }) },
            ],
            isError: true,
          };
        }

        if (from === to) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Self-referencing edges are not allowed" }) },
            ],
            isError: true,
          };
        }

        const fromNode = store.getNodeById(from);
        if (!fromNode) {
          const err = new NodeNotFoundError(from);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: err.message }) },
            ],
            isError: true,
          };
        }

        const toNode = store.getNodeById(to);
        if (!toNode) {
          const err = new NodeNotFoundError(to);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: err.message }) },
            ],
            isError: true,
          };
        }

        const edge = {
          id: generateId("edge"),
          from,
          to,
          relationType: relationType as RelationType,
          reason,
          weight,
          createdAt: now(),
        };

        store.insertEdge(edge);

        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ok: true, edge }, null, 2) },
          ],
        };
      }

      if (action === "delete") {
        if (!id) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "id is required for delete action" }) },
            ],
            isError: true,
          };
        }

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
            { type: "text" as const, text: JSON.stringify({ ok: true, deletedId: id }, null, 2) },
          ],
        };
      }

      // action === "list"
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
          { type: "text" as const, text: JSON.stringify({ total: edges.length, edges }, null, 2) },
        ],
      };
    },
  );
}
