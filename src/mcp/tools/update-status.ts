import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { NodeStatus } from "../../core/graph/graph-types.js";
import { NodeStatusSchema } from "../../schemas/node.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const VALID_TRANSITIONS: Record<string, string[]> = {
  backlog: ["ready", "in_progress", "blocked"],
  ready: ["in_progress", "blocked", "backlog"],
  in_progress: ["done", "blocked", "ready"],
  blocked: ["ready", "in_progress", "backlog"],
  done: ["in_progress"],  // allow reopen
};

export function registerUpdateStatus(server: McpServer, store: SqliteStore): void {
  server.tool(
    "update_status",
    "Update the status of one or more nodes. Pass a single ID string or an array of IDs for bulk updates.",
    {
      id: z.union([z.string(), z.array(z.string())]).describe("Node ID (string) or array of node IDs for bulk update"),
      status: NodeStatusSchema.describe("The new status"),
      force: z.boolean().optional().describe("Force status change, bypass transition validation"),
    },
    async ({ id, status, force }) => {
      const ids = Array.isArray(id) ? id : [id];
      const isBulk = ids.length > 1;

      logger.debug("tool:update_status", { ids, status, bulk: isBulk, force });

      if (isBulk) {
        // Validate transitions for bulk update
        const bulkWarnings: string[] = [];
        if (!force) {
          for (const nodeId of ids) {
            const currentNode = store.getNodeById(nodeId);
            if (currentNode) {
              const allowed = VALID_TRANSITIONS[currentNode.status] ?? [];
              if (!allowed.includes(status as string)) {
                bulkWarnings.push(`${nodeId}: ${currentNode.status} → ${status}`);
              }
            }
          }
        }

        const result = store.bulkUpdateStatus(ids, status as NodeStatus);
        logger.info("tool:update_status:ok", { count: ids.length, status, updated: result.updated.length });
        const bulkResult: Record<string, unknown> = { ok: true, ...result };
        if (bulkWarnings.length > 0) bulkResult.warnings = bulkWarnings;
        return mcpText(bulkResult);
      }

      // Validate status transition for single update
      let transitionWarning: string | undefined;
      if (!force) {
        const currentNode = store.getNodeById(ids[0]);
        if (currentNode) {
          const allowed = VALID_TRANSITIONS[currentNode.status] ?? [];
          if (!allowed.includes(status as string)) {
            transitionWarning = `Status skip: ${currentNode.status} → ${status}. Recommended flow: backlog→ready→in_progress→done.`;
          }
        }
      }

      // Single node update
      const updated = store.updateNodeStatus(ids[0], status as NodeStatus);

      if (!updated) {
        const err = new NodeNotFoundError(ids[0]);
        logger.warn("tool:update_status:fail", { error: err.message });
        return mcpError(err);
      }

      logger.info("tool:update_status:ok", { id: ids[0], status });
      const result: Record<string, unknown> = { ok: true, node: updated };
      if (transitionWarning) result.warning = transitionWarning;
      return mcpText(result);
    },
  );
}
