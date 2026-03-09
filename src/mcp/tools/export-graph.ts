import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

export function registerExportGraph(server: McpServer, store: SqliteStore): void {
  server.tool(
    "export_graph",
    "Export the complete graph as a JSON document",
    {},
    async () => {
      const doc = store.toGraphDocument();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(doc, null, 2),
          },
        ],
      };
    },
  );
}
