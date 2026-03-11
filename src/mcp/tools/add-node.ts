import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { RelationType } from "../../core/graph/graph-types.js";
import { NodeTypeSchema, NodeStatusSchema, XpSizeSchema, PrioritySchema } from "../../schemas/node.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import { logger } from "../../core/utils/logger.js";

export function registerAddNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "add_node",
    "Create a single node in the graph",
    {
      type: NodeTypeSchema.describe("Node type (epic, task, subtask, etc.)"),
      title: z.string().describe("Node title"),
      description: z.string().optional().describe("Node description"),
      status: NodeStatusSchema.optional().describe("Node status (default: backlog)"),
      priority: PrioritySchema.optional().describe("Priority 1-5 (default: 3)"),
      xpSize: XpSizeSchema.optional().describe("Size: XS, S, M, L, XL"),
      estimateMinutes: z.number().optional().describe("Time estimate in minutes"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      parentId: z.string().nullable().optional().describe("Parent node ID"),
      sprint: z.string().nullable().optional().describe("Sprint identifier"),
      acceptanceCriteria: z.array(z.string()).optional().describe("Acceptance criteria"),
      blocked: z.boolean().optional().describe("Whether the node is blocked"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Custom metadata"),
    },
    async (args) => {
      logger.debug("tool:add_node", { type: args.type, title: args.title, parentId: args.parentId });
      if (args.parentId) {
        const parent = store.getNodeById(args.parentId);
        if (!parent) {
          const err = new NodeNotFoundError(args.parentId);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: `Parent not found: ${err.message}` }) },
            ],
            isError: true,
          };
        }
      }

      const timestamp = now();
      const node = {
        id: generateId("node"),
        type: args.type,
        title: args.title,
        description: args.description,
        status: args.status ?? "backlog" as const,
        priority: args.priority ?? (3 as const),
        xpSize: args.xpSize,
        estimateMinutes: args.estimateMinutes,
        tags: args.tags,
        parentId: args.parentId,
        sprint: args.sprint,
        acceptanceCriteria: args.acceptanceCriteria,
        blocked: args.blocked,
        metadata: args.metadata,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      store.insertNode(node);

      if (args.parentId) {
        store.insertEdge({
          id: generateId("edge"),
          from: args.parentId,
          to: node.id,
          relationType: "parent_of" as RelationType,
          createdAt: timestamp,
        });
        store.insertEdge({
          id: generateId("edge"),
          from: node.id,
          to: args.parentId,
          relationType: "child_of" as RelationType,
          createdAt: timestamp,
        });
      }

      logger.info("tool:add_node:ok", { nodeId: node.id, type: node.type });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, node }, null, 2),
          },
        ],
      };
    },
  );
}
