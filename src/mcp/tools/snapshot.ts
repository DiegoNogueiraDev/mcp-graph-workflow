import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerSnapshot(server: McpServer, store: SqliteStore): void {
  server.tool(
    "snapshot",
    "Manage graph snapshots: create, list, or restore",
    {
      action: z.enum(["create", "list", "restore"]).describe("Action to perform"),
      snapshotId: z.number().int().min(1).optional().describe("Snapshot ID (positive integer, required for restore)"),
    },
    async ({ action, snapshotId }) => {
      logger.debug("tool:snapshot", { action });
      if (action === "create") {
        const id = store.createSnapshot();
        logger.info("tool:snapshot:ok", { action: "create", snapshotId: id });
        return mcpText({ ok: true, snapshotId: id });
      }

      if (action === "list") {
        const snapshots = store.listSnapshots();
        logger.info("tool:snapshot:ok", { action: "list", total: snapshots.length });
        return mcpText({ total: snapshots.length, snapshots });
      }

      // action === "restore"
      if (snapshotId === undefined) {
        return mcpError("snapshotId is required for restore action");
      }

      store.restoreSnapshot(snapshotId);
      logger.info("tool:snapshot:ok", { action: "restore", restoredFrom: snapshotId });
      return mcpText({ ok: true, restoredFrom: snapshotId });
    },
  );
}
