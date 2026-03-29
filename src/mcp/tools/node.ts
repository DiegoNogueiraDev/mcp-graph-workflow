/**
 * MCP Tool — node
 * Consolidated CRUD for graph nodes (add, update, delete).
 * Replaces separate add_node, update_node, delete_node tools.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { RelationType } from "../../core/graph/graph-types.js";
import { NodeTypeSchema, NodeStatusSchema, XpSizeSchema, PrioritySchema } from "../../schemas/node.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { DEFAULT_NODE_STATUS, DEFAULT_NODE_PRIORITY } from "../../core/utils/constants.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import { logger } from "../../core/utils/logger.js";
import { checkCircularity } from "../../core/utils/circularity.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";
import { indexNodeAsKnowledge, removeNodeFromKnowledge } from "../../core/rag/node-indexer.js";

export function registerNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "node",
    "Manage graph nodes: add, update, or delete",
    {
      action: z.enum(["add", "update", "delete"]).describe("Action to perform"),
      // add params
      type: NodeTypeSchema.optional().describe("Node type — required for add (epic, task, subtask, etc.)"),
      title: z.string().optional().describe("Node title — required for add"),
      description: z.string().optional().describe("Node description (add/update)"),
      status: NodeStatusSchema.optional().describe("Node status (add: default backlog, update: new status)"),
      priority: PrioritySchema.optional().describe("Priority 1-5 (add: default 3, update)"),
      xpSize: XpSizeSchema.optional().describe("Size: XS, S, M, L, XL (add/update)"),
      estimateMinutes: z.number().optional().describe("Time estimate in minutes (add/update)"),
      tags: z.array(z.string()).optional().describe("Tags for categorization (add/update)"),
      parentId: z.string().nullable().optional().describe("Parent node ID (add/update)"),
      sprint: z.string().nullable().optional().describe("Sprint identifier (add/update)"),
      acceptanceCriteria: z.array(z.string()).optional().describe("Acceptance criteria (add/update)"),
      blocked: z.boolean().optional().describe("Whether the node is blocked (add)"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Custom metadata (add)"),
      // update/delete params
      id: z.string().min(1).optional().describe("Node ID — required for update/delete"),
    },
    async ({ action, id, type, title, description, status, priority, xpSize, estimateMinutes, tags, parentId, sprint, acceptanceCriteria, blocked, metadata }) => {
      logger.debug("tool:node", { action, id, type, title });

      if (action === "add") {
        if (!type || !title) {
          return mcpError("type and title are required for add action");
        }

        if (parentId) {
          const parent = store.getNodeById(parentId);
          if (!parent) {
            const err = new NodeNotFoundError(parentId);
            return mcpError(`Parent not found: ${err.message}`);
          }
        }

        const timestamp = now();
        const node = {
          id: generateId("node"),
          type,
          title,
          description: normalizeNewlines(description),
          status: status ?? DEFAULT_NODE_STATUS,
          priority: priority ?? DEFAULT_NODE_PRIORITY,
          xpSize,
          estimateMinutes,
          tags,
          parentId,
          sprint,
          acceptanceCriteria,
          blocked,
          metadata,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        store.insertNode(node);

        if (parentId) {
          store.insertEdge({
            id: generateId("edge"),
            from: parentId,
            to: node.id,
            relationType: "parent_of" as RelationType,
            createdAt: timestamp,
          });
          store.insertEdge({
            id: generateId("edge"),
            from: node.id,
            to: parentId,
            relationType: "child_of" as RelationType,
            createdAt: timestamp,
          });
        }

        indexNodeAsKnowledge(store.getDb(), node);
        logger.info("tool:node:add:ok", { nodeId: node.id, type: node.type });
        return mcpText({ ok: true, node });
      }

      if (action === "update") {
        if (!id) {
          return mcpError("id is required for update action");
        }

        const fields: Record<string, unknown> = {};
        if (title !== undefined) fields.title = title;
        if (description !== undefined) fields.description = normalizeNewlines(description);
        if (type !== undefined) fields.type = type;
        if (priority !== undefined) fields.priority = priority;
        if (xpSize !== undefined) fields.xpSize = xpSize;
        if (estimateMinutes !== undefined) fields.estimateMinutes = estimateMinutes;
        if (tags !== undefined) fields.tags = tags;
        if (sprint !== undefined) fields.sprint = sprint;
        if (parentId !== undefined) fields.parentId = parentId;
        if (acceptanceCriteria !== undefined) fields.acceptanceCriteria = acceptanceCriteria;

        // Bug #036: reject self-parenting and circularity in update action
        const circError = checkCircularity(store, id, parentId);
        if (circError) return mcpError(circError);

        // If parentId is changing, manage edges atomically (Bug #047)
        if (parentId !== undefined) {
          const db = store.getDb();
          db.transaction(() => {
            const existingNode = store.getNodeById(id);
            if (existingNode) {
              const oldParentId = existingNode.parentId;

              // Remove old parent/child edges
              if (oldParentId) {
                const edgesFromOldParent = store.getEdgesFrom(oldParentId);
                for (const edge of edgesFromOldParent) {
                  if (edge.to === id && edge.relationType === "parent_of") {
                    store.deleteEdge(edge.id);
                  }
                }
                const edgesFromNode = store.getEdgesFrom(id);
                for (const edge of edgesFromNode) {
                  if (edge.to === oldParentId && edge.relationType === "child_of") {
                    store.deleteEdge(edge.id);
                  }
                }
              }

              // Create new parent/child edges
              if (parentId !== null) {
                const timestamp = now();
                store.insertEdge({
                  id: generateId("edge"),
                  from: parentId,
                  to: id,
                  relationType: "parent_of" as RelationType,
                  createdAt: timestamp,
                });
                store.insertEdge({
                  id: generateId("edge"),
                  from: id,
                  to: parentId,
                  relationType: "child_of" as RelationType,
                  createdAt: timestamp,
                });
              }
            }
          })();
        }

        const updated = store.updateNode(id, fields);
        if (!updated) {
          const err = new NodeNotFoundError(id);
          logger.warn("tool:node:update:fail", { error: err.message });
          return mcpError(err);
        }

        indexNodeAsKnowledge(store.getDb(), updated);
        logger.info("tool:node:update:ok", { id });
        return mcpText({ ok: true, node: updated });
      }

      // action === "delete"
      if (!id) {
        return mcpError("id is required for delete action");
      }

      // Clean up knowledge BEFORE deleting node to avoid orphaned docs
      removeNodeFromKnowledge(store.getDb(), id);

      const deleted = store.deleteNode(id);
      if (!deleted) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:node:delete:fail", { error: err.message });
        return mcpError(err);
      }

      logger.info("tool:node:delete:ok", { id });
      return mcpText({ ok: true, deletedId: id });
    },
  );
}
