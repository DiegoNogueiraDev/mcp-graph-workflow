/**
 * MCP Tool: siebel_search
 * Search indexed Siebel objects in the knowledge store.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { SiebelObjectTypeSchema } from "../../schemas/siebel.schema.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerSiebelSearch(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel_search",
    "Search indexed Siebel objects in the knowledge store. Find Business Components, Applets, Views, Workflows, etc. by name or content.",
    {
      query: z.string().min(1).describe("Search query (e.g., 'Account', 'Workflow', 'BUS_COMP')"),
      objectType: SiebelObjectTypeSchema.optional().describe("Filter by Siebel object type"),
      limit: z.number().int().min(1).max(50).optional().default(10).describe("Maximum results"),
    },
    async ({ query, objectType, limit }) => {
      logger.info("tool:siebel_search", { query, objectType, limit });

      try {
        const knowledgeStore = new KnowledgeStore(store.getDb());
        const allResults = knowledgeStore.search(query, limit * 3); // over-fetch for filtering

        // Filter to Siebel sources
        let siebelResults = allResults.filter(
          (d) => d.sourceType === "siebel_sif" || d.sourceType === "siebel_composer",
        );

        // Optional type filter
        if (objectType) {
          siebelResults = siebelResults.filter(
            (d) => d.metadata?.siebelType === objectType,
          );
        }

        // Apply limit
        siebelResults = siebelResults.slice(0, limit);

        return mcpText({
          ok: true,
          query,
          objectType: objectType ?? "all",
          resultCount: siebelResults.length,
          results: siebelResults.map((d) => ({
            title: d.title,
            sourceType: d.sourceType,
            siebelType: d.metadata?.siebelType,
            siebelProject: d.metadata?.siebelProject,
            content: d.content.slice(0, 200) + (d.content.length > 200 ? "..." : ""),
          })),
        });
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
