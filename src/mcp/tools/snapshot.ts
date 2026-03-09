import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

export function registerSnapshot(server: McpServer, store: SqliteStore): void {
  server.tool(
    "snapshot",
    "Manage graph snapshots: create, list, or restore",
    {
      action: z.enum(["create", "list", "restore"]).describe("Action to perform"),
      snapshotId: z.number().optional().describe("Snapshot ID (required for restore)"),
    },
    async ({ action, snapshotId }) => {
      if (action === "create") {
        const id = store.createSnapshot();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ok: true, snapshotId: id }, null, 2) },
          ],
        };
      }

      if (action === "list") {
        const snapshots = store.listSnapshots();
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
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ ok: true, restoredFrom: snapshotId }, null, 2) },
        ],
      };
    },
  );
}
