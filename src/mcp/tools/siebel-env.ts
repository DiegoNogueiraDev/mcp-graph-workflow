/**
 * MCP Tool: siebel_env
 * Manage Siebel environment configurations (dev, test, staging, prod).
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  loadSiebelConfig,
  addEnvironment,
  removeEnvironment,
} from "../../core/siebel/siebel-config.js";
import { SiebelEnvironmentTypeSchema } from "../../schemas/siebel.schema.js";
import { STORE_DIR } from "../../core/utils/constants.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";
import path from "node:path";

export function registerSiebelEnv(server: McpServer, _store: SqliteStore): void {
  server.tool(
    "siebel_env",
    "Manage Siebel CRM environment configurations. Actions: list (show all), add (register new), remove (delete by name).",
    {
      action: z.enum(["list", "add", "remove"]).describe("Action to perform"),
      name: z.string().optional().describe("Environment name (required for add/remove)"),
      url: z.string().url().optional().describe("Siebel application URL (required for add)"),
      version: z.string().optional().default("15.0").describe("Siebel version"),
      type: SiebelEnvironmentTypeSchema.optional().default("dev").describe("Environment type"),
      composerUrl: z.string().url().optional().describe("Siebel Composer URL"),
      restApiUrl: z.string().url().optional().describe("Siebel REST API base URL"),
    },
    async ({ action, name, url, version, type, composerUrl, restApiUrl }) => {
      logger.info("tool:siebel_env", { action, name });

      const graphDir = path.join(process.cwd(), STORE_DIR);

      try {
        switch (action) {
          case "list": {
            const envs = loadSiebelConfig(graphDir);
            return mcpText({ ok: true, environments: envs, count: envs.length });
          }

          case "add": {
            if (!name || !url) {
              return mcpError("name and url are required to add an environment");
            }
            const envs = addEnvironment(graphDir, {
              name,
              url,
              version,
              type,
              ...(composerUrl ? { composerUrl } : {}),
              ...(restApiUrl ? { restApiUrl } : {}),
            });
            return mcpText({ ok: true, added: name, environments: envs });
          }

          case "remove": {
            if (!name) {
              return mcpError("name is required to remove an environment");
            }
            const envs = removeEnvironment(graphDir, name);
            return mcpText({ ok: true, removed: name, environments: envs });
          }

          default:
            return mcpError(`Unknown action: ${action}`);
        }
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
