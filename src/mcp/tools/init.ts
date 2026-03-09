import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

export function registerInit(server: McpServer, store: SqliteStore): void {
  server.tool(
    "init",
    "Initialize a new project graph",
    { projectName: z.string().optional().describe("Name for the project") },
    async ({ projectName }) => {
      const project = store.initProject(projectName || undefined);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ok: true, project },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
