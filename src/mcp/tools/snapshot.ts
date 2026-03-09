import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

export function registerCreateSnapshot(server: McpServer, store: SqliteStore): void {
  server.tool(
    "create_snapshot",
    "Create a snapshot of the current graph state",
    {},
    async () => {
      const snapshotId = store.createSnapshot();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, snapshotId }, null, 2),
          },
        ],
      };
    },
  );
}

export function registerListSnapshots(server: McpServer, store: SqliteStore): void {
  server.tool(
    "list_snapshots",
    "List all available snapshots for the current project",
    {},
    async () => {
      const snapshots = store.listSnapshots();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ total: snapshots.length, snapshots }, null, 2),
          },
        ],
      };
    },
  );
}

export function registerRestoreSnapshot(server: McpServer, store: SqliteStore): void {
  server.tool(
    "restore_snapshot",
    "Restore the graph to a previous snapshot state",
    {
      snapshotId: z.number().describe("The snapshot ID to restore"),
    },
    async ({ snapshotId }) => {
      store.restoreSnapshot(snapshotId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, restoredFrom: snapshotId }, null, 2),
          },
        ],
      };
    },
  );
}
