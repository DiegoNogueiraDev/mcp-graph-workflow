/**
 * MCP Tool: siebel_composer
 * Automate Siebel Composer web UI via Playwright MCP integration.
 *
 * This tool builds structured instructions for the Playwright MCP server
 * to interact with Siebel Composer. It returns step-by-step browser automation
 * instructions that can be executed by the AI agent using Playwright tools.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildComposerInstructions } from "../../core/siebel/composer-automation.js";
import { findEnvironment } from "../../core/siebel/siebel-config.js";
import { STORE_DIR } from "../../core/utils/constants.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";
import path from "node:path";

export function registerSiebelComposer(server: McpServer, _store: SqliteStore): void {
  server.tool(
    "siebel_composer",
    "Automate Siebel Composer web UI. Returns Playwright instructions for browser automation. Actions: navigate (open Composer or specific object), import_sif (upload SIF file), edit (modify object property), publish (deploy changes), capture (screenshot current state).",
    {
      action: z.enum(["navigate", "import_sif", "edit", "publish", "capture"]).describe("Composer action"),
      envName: z.string().describe("Siebel environment name (from siebel_env list)"),
      sifPath: z.string().optional().describe("SIF file path (for import_sif action)"),
      objectName: z.string().optional().describe("Siebel object name to navigate to or edit"),
      property: z.string().optional().describe("Property name to edit"),
      value: z.string().optional().describe("New value for the property"),
      selector: z.string().optional().describe("CSS selector for waiting/capturing"),
      timeout: z.number().int().min(1000).optional().describe("Timeout in milliseconds"),
    },
    async ({ action, envName, sifPath, objectName, property, value, selector, timeout }) => {
      logger.info("tool:siebel_composer", { action, envName, objectName });

      try {
        const graphDir = path.join(process.cwd(), STORE_DIR);
        const env = findEnvironment(graphDir, envName);

        if (!env) {
          return mcpError(`Siebel environment "${envName}" not found. Use siebel_env action=list to see available environments, or siebel_env action=add to register one.`);
        }

        const instructions = buildComposerInstructions({
          env,
          action,
          sifPath,
          objectName,
          property,
          value,
          selector,
          timeout,
        });

        return mcpText({
          ok: true,
          action,
          envName,
          composerUrl: env.composerUrl ?? `${env.url}/composer`,
          instructions: instructions.steps,
          description: instructions.description,
          hint: "Use Playwright MCP tools (browser_navigate, browser_click, browser_type, browser_file_upload, browser_take_screenshot) to execute these steps sequentially.",
        });
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
