import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { GraphEdge, RelationType } from "../../core/graph/graph-types.js";
import { RelationTypeSchema } from "../../schemas/edge.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

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
      logger.debug("tool:edge", { action, from, to, relationType });
      if (action === "add") {
        if (!from || !to || !relationType) {
          return mcpError("from, to, and relationType are required for add action");
        }

        if (from === to) {
          return mcpError("Self-referencing edges are not allowed");
        }

        const fromNode = store.getNodeById(from);
        if (!fromNode) {
          return mcpError(new NodeNotFoundError(from));
        }

        const toNode = store.getNodeById(to);
        if (!toNode) {
          return mcpError(new NodeNotFoundError(to));
        }

        // Check for duplicate edge
        const existingEdges = store.getEdgesFrom(from);
        const duplicate = existingEdges.find(
          (e) => e.to === to && e.relationType === (relationType as RelationType),
        );
        if (duplicate) {
          logger.info("tool:edge:ok", { action: "existing", edgeId: duplicate.id, from, to, relationType });
          return mcpText({ ok: true, edge: duplicate, existing: true });
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

        logger.info("tool:edge:ok", { action: "add", edgeId: edge.id, from, to, relationType });
        return mcpText({ ok: true, edge });
      }

      if (action === "delete") {
        if (!id) {
          return mcpError("id is required for delete action");
        }

        const deleted = store.deleteEdge(id);
        if (!deleted) {
          return mcpError(`Edge not found: ${id}`);
        }

        logger.info("tool:edge:ok", { action: "delete", deletedId: id });
        return mcpText({ ok: true, deletedId: id });
      }

      // action === "list"
      let edges: GraphEdge[];

      if (nodeId) {
        const node = store.getNodeById(nodeId);
        if (!node) {
          return mcpError(new NodeNotFoundError(nodeId));
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

      logger.info("tool:edge:ok", { action: "list", total: edges.length });
      return mcpText({ total: edges.length, edges });
    },
  );
}
