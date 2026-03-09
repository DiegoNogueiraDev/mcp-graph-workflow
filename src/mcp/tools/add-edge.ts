import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { RelationType } from "../../core/graph/graph-types.js";
import { RelationTypeSchema } from "../../schemas/edge.schema.js";
import { NodeNotFoundError, McpGraphError } from "../../core/utils/errors.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";

export function registerAddEdge(server: McpServer, store: SqliteStore): void {
  server.tool(
    "add_edge",
    "Create an edge (relationship) between two nodes",
    {
      from: z.string().describe("Source node ID"),
      to: z.string().describe("Target node ID"),
      relationType: RelationTypeSchema.describe("Type of relationship"),
      reason: z.string().optional().describe("Why this relationship exists"),
      weight: z.number().optional().describe("Edge weight (0-1)"),
    },
    async ({ from, to, relationType, reason, weight }) => {
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
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, edge }, null, 2),
          },
        ],
      };
    },
  );
}
