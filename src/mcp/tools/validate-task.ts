import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { runValidation } from "../../core/capture/validate-runner.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexCapture } from "../../core/rag/capture-indexer.js";
import { logger } from "../../core/utils/logger.js";

export function registerValidateTask(server: McpServer, store: SqliteStore): void {
  server.tool(
    "validate_task",
    "Run browser-based validation for a task. Captures a URL, optionally compares with a second URL (A/B), and indexes the captured content into the knowledge store.",
    {
      url: z.string().url().describe("URL to validate"),
      compareUrl: z
        .string()
        .url()
        .optional()
        .describe("Second URL for A/B comparison"),
      selector: z
        .string()
        .optional()
        .describe("CSS selector to scope content extraction"),
      nodeId: z
        .string()
        .optional()
        .describe("Associate validation with a graph node"),
    },
    async ({ url, compareUrl, selector, nodeId }) => {
      logger.debug("tool:validate_task", { nodeId });
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

      logger.info("tool:validate_task:ok", { nodeId, url });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        }],
      };
    },
  );
}
