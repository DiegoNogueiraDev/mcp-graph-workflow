import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { logger } from "../../core/utils/logger.js";

export function registerSnapshot(server: McpServer, store: SqliteStore): void {
  server.tool(
    "snapshot",
    "Manage graph snapshots: create, list, or restore",
    {
      action: z.enum(["create", "list", "restore"]).describe("Action to perform"),
      snapshotId: z.number().optional().describe("Snapshot ID (required for restore)"),
    },
    async ({ action, snapshotId }) => {
      logger.debug("tool:snapshot", { action });
      if (action === "create") {
        const id = store.createSnapshot();
        logger.info("tool:snapshot:ok", { action: "create", snapshotId: id });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ok: true, snapshotId: id }, null, 2) },
          ],
        };
      }

      if (action === "list") {
        const snapshots = store.listSnapshots();
        logger.info("tool:snapshot:ok", { action: "list", total: snapshots.length });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ total: snapshots.length, snapshots }, null, 2) },
          ],
        };
      }

      // action === "restore"
      if (snapshotId === undefined) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "snapshotId is required for restore action" }) },
          ],
          isError: true,
        };
      }

      store.restoreSnapshot(snapshotId);
      logger.info("tool:snapshot:ok", { action: "restore", restoredFrom: snapshotId });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ ok: true, restoredFrom: snapshotId }, null, 2) },
        ],
      };
    },
  );
}
