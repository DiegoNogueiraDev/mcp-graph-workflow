/**
 * MCP Tool — validate
 * Consolidated validation tool (task browser validation + AC quality check).
 * Replaces separate validate_task and validate_ac tools.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { runValidation } from "../../core/capture/validate-runner.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexCapture } from "../../core/rag/capture-indexer.js";
import { validateAcQuality } from "../../core/analyzer/ac-validator.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerValidate(server: McpServer, store: SqliteStore): void {
  server.tool(
    "validate",
    "Validate tasks: browser-based validation (task) or acceptance criteria quality check (ac)",
    {
      action: z.enum(["task", "ac"]).describe("Action: 'task' for browser validation, 'ac' for AC quality check"),
      // task params
      url: z.string().url().optional().describe("URL to validate — required for action 'task'"),
      compareUrl: z.string().url().optional().describe("Second URL for A/B comparison (task only)"),
      selector: z.string().optional().describe("CSS selector to scope content extraction (task only)"),
      // shared
      nodeId: z.string().optional().describe("Graph node ID (task: associate validation; ac: validate specific node)"),
      // ac params
      all: z.boolean().optional().describe("Validate all nodes with AC (ac only, default: true if no nodeId)"),
    },
    async ({ action, url, compareUrl, selector, nodeId, all }) => {
      logger.debug("tool:validate", { action, nodeId });

      if (action === "task") {
        if (!url) {
          return mcpError("url is required for task action");
        }

        const result = await runValidation(url, { compareUrl, selector });

        // Index captured content into knowledge store
        const knowledgeStore = new KnowledgeStore(store.getDb());
        indexCapture(knowledgeStore, result.primary);
        if (result.comparison) {
          indexCapture(knowledgeStore, result.comparison);
        }

        const response: Record<string, unknown> = {
          ok: true,
          url,
          wordCount: result.primary.wordCount,
          title: result.primary.title,
          timestamp: result.timestamp,
        };

        if (nodeId) {
          response.nodeId = nodeId;
        }

        if (result.diff) {
          response.comparison = {
            compareUrl,
            wordCountDelta: result.diff.wordCountDelta,
            lengthDelta: result.diff.lengthDelta,
          };
        }

        logger.info("tool:validate:task:ok", { nodeId, url });
        return mcpText(response);
      }

      // action === "ac"
      const doc = store.toGraphDocument();
      const report = validateAcQuality(doc, nodeId, all ?? !nodeId);

      logger.info("tool:validate:ac:ok", { nodes: report.nodes.length, score: report.overallScore });
      return mcpText({ ok: true, ...report });
    },
  );
}
