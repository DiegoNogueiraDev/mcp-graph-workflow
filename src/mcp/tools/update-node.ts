/**
 * @deprecated Use `node` tool with action:"update" instead. Will be removed in v7.0.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { NodeTypeSchema, XpSizeSchema, PrioritySchema } from "../../schemas/node.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

export function registerUpdateNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "update_node",
    "Update arbitrary fields of a node (DEPRECATED — use `node` with action:\"update\")",
    {
      id: z.string().describe("The node ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      type: NodeTypeSchema.optional().describe("New node type"),
      priority: PrioritySchema.optional().describe("New priority (1=highest, 5=lowest)"),
      xpSize: XpSizeSchema.optional().describe("New XP size estimate"),
      estimateMinutes: z.number().optional().describe("New time estimate in minutes"),
      tags: z.array(z.string()).optional().describe("New tags array"),
      sprint: z.string().nullable().optional().describe("Sprint assignment (null to clear)"),
      parentId: z.string().nullable().optional().describe("New parent node ID (null to clear)"),
      acceptanceCriteria: z
        .array(z.string())
        .optional()
        .describe("New acceptance criteria"),
    },
    async ({ id, ...fields }) => {
      logger.warn("tool:update_node:deprecated", { message: "Use 'node' tool with action:'update' instead" });
      logger.debug("tool:update_node", { id, fields: Object.keys(fields) });
      const updated = store.updateNode(id, fields);

      if (!updated) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:update_node:fail", { error: err.message });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: err.message, _deprecated: "Use 'node' tool with action:'update'" }) },
          ],
          isError: true,
        };
      }

      logger.info("tool:update_node:ok", { id });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, node: updated, _deprecated: "Use 'node' tool with action:'update'" }, null, 2),
          },
        ],
      };
    },
  );
}
