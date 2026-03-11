import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { searchNodes } from "../../core/search/fts-search.js";
import { logger } from "../../core/utils/logger.js";

export function registerSearch(server: McpServer, store: SqliteStore): void {
  server.tool(
    "search",
    "Full-text search across graph nodes using BM25 ranking. Searches title, description and tags.",
    {
      query: z.string().describe("Search query text"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum results to return (default: 20)"),
      rerank: z
        .boolean()
        .optional()
        .describe("Apply TF-IDF reranking for better relevance (default: false)"),
    },
    async ({ query, limit, rerank }) => {
      logger.debug("tool:search", { query, limit });
      const results = searchNodes(store, query, { limit: limit ?? 20, rerank: rerank ?? false });

      const items = results.map((r) => ({
        id: r.node.id,
        type: r.node.type,
        title: r.node.title,
        status: r.node.status,
        priority: r.node.priority,
        score: Math.round(r.score * 1000) / 1000,
        snippet: r.node.description?.slice(0, 200) ?? null,
      }));

      logger.info("tool:search:ok", { query, total: items.length });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { query, total: items.length, results: items },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
