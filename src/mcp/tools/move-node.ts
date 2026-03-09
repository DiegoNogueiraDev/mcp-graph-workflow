import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import type { RelationType } from "../../core/graph/graph-types.js";

export function registerMoveNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "move_node",
    "Move a node to a new parent in the hierarchy",
    {
      id: z.string().describe("The node ID to move"),
      newParentId: z.string().nullable().describe("New parent node ID (null to make root)"),
    },
    async ({ id, newParentId }) => {
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

      if (newParentId !== null) {
        if (newParentId === id) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "A node cannot be its own parent" }) },
            ],
            isError: true,
          };
        }

        const newParent = store.getNodeById(newParentId);
        if (!newParent) {
          const err = new NodeNotFoundError(newParentId);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: `New parent not found: ${err.message}` }) },
            ],
            isError: true,
          };
        }

        // Detect circularity: walk up from newParentId to check if id is an ancestor
        let current = newParent;
        while (current.parentId) {
          if (current.parentId === id) {
            return {
              content: [
                { type: "text" as const, text: JSON.stringify({ error: "Circular reference detected: target parent is a descendant of this node" }) },
              ],
              isError: true,
            };
          }
          const parent = store.getNodeById(current.parentId);
          if (!parent) break;
          current = parent;
        }
      }

      const oldParentId = node.parentId;

      // Remove old parent/child edges
      if (oldParentId) {
        const edgesFrom = store.getEdgesFrom(oldParentId);
        for (const edge of edgesFrom) {
          if (edge.to === id && edge.relationType === "parent_of") {
            store.deleteEdge(edge.id);
          }
        }
        const edgesFrom2 = store.getEdgesFrom(id);
        for (const edge of edgesFrom2) {
          if (edge.to === oldParentId && edge.relationType === "child_of") {
            store.deleteEdge(edge.id);
          }
        }
      }

      // Update parentId
      store.updateNode(id, { parentId: newParentId });

      // Create new parent/child edges
      if (newParentId !== null) {
        const timestamp = now();
        store.insertEdge({
          id: generateId("edge"),
          from: newParentId,
          to: id,
          relationType: "parent_of" as RelationType,
          createdAt: timestamp,
        });
        store.insertEdge({
          id: generateId("edge"),
          from: id,
          to: newParentId,
          relationType: "child_of" as RelationType,
          createdAt: timestamp,
        });
      }

      const updated = store.getNodeById(id);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ok: true,
              moved: { id, from: oldParentId ?? null, to: newParentId },
              node: updated,
            }, null, 2),
          },
        ],
      };
    },
  );
}
