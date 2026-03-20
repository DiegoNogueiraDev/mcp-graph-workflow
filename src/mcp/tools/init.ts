import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerInit(server: McpServer, store: SqliteStore): void {
  server.tool(
    "init",
    "Initialize a new project graph",
    { projectName: z.string().optional().describe("Name for the project") },
    async ({ projectName }) => {
      logger.debug("tool:init", { projectName });
      const project = store.initProject(projectName || undefined);
      logger.info("tool:init:ok", { projectId: project.id });
      return mcpText({ ok: true, project });
    },
  );
}
