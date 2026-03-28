import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerInit(server: McpServer, store: SqliteStore): void {
  server.tool(
    "init",
    "Initialize a new project graph",
    { projectName: z.string().optional().describe("Name for the project") },
    async ({ projectName }) => {
      logger.debug("tool:init", { projectName });

      // Bug #021: sanitize projectName — reject path traversal and special chars
      if (projectName && (/[/\\]/.test(projectName) || projectName.includes("\0") || projectName.includes(".."))) {
        return mcpError("Invalid project name: must not contain path separators, '..' or null bytes");
      }

      const project = store.initProject(projectName || undefined);
      logger.info("tool:init:ok", { projectId: project.id });
      return mcpText({ ok: true, project });
    },
  );
}
