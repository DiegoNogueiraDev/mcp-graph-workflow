import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { searchNodes } from "../../core/search/fts-search.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerSearch(server: McpServer, store: SqliteStore): void {
  server.tool(
    "search",
    "Full-text search across graph nodes using BM25 ranking. Searches title, description and tags.",
    {
      query: z.string().min(1).describe("Search query text"),
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

      // Bug #063: detect wildcard-only queries that produce empty FTS results
      if (/^[*?]+$/.test(query.trim())) {
        return mcpText({
          query,
          total: 0,
          hasMore: false,
          results: [],
          hint: "Wildcard-only queries not supported by FTS. Use list() to see all nodes.",
        });
      }

      const results = searchNodes(store, query, { limit: limit ?? 20, rerank: rerank ?? false });

      const items = results.map((r) => ({
        id: r.node.id,
        type: r.node.type,
        title: r.node.title,
        status: r.node.status,
        priority: r.node.priority,
        score: Math.round(r.score * 1000) / 1000,
        // Bug #064: fallback to title when description is null
        snippet: r.node.description?.slice(0, 200) ?? r.node.title,
      }));

      // Bug #024: indicate when results may be truncated by limit
      const effectiveLimit = limit ?? 20;
      const hasMore = items.length >= effectiveLimit;
      logger.info("tool:search:ok", { query, total: items.length, hasMore });
      return mcpText({ query, total: items.length, hasMore, results: items });
    },
  );
}
