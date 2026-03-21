/**
 * MCP Tool — knowledge_feedback
 * Allows AI or user to mark knowledge documents as helpful, unhelpful, or outdated.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { applyFeedback } from "../../core/rag/knowledge-feedback.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerKnowledgeFeedback(server: McpServer, store: SqliteStore): void {
  server.tool(
    "knowledge_feedback",
    "Provide feedback on a knowledge document to improve RAG quality. Mark docs as helpful, unhelpful, or outdated.",
    {
      docId: z.string().describe("Knowledge document ID"),
      action: z.enum(["helpful", "unhelpful", "outdated"]).describe("Feedback action"),
      query: z.string().optional().describe("The query that surfaced this document"),
      context: z.string().optional().describe("Additional context about why this feedback is given"),
    },
    async ({ docId, action, query, context }) => {
      logger.debug("tool:knowledge_feedback", { docId, action });

      try {
        const contextObj = context ? { note: context } : undefined;
        applyFeedback(store.getDb(), docId, query ?? "", action, contextObj);

        logger.info("tool:knowledge_feedback:ok", { docId, action });
        return mcpText({
          ok: true,
          docId,
          action,
          message: `Feedback '${action}' applied to document ${docId}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn("tool:knowledge_feedback:fail", { error: message });
        return mcpError(message);
      }
    },
  );
}
