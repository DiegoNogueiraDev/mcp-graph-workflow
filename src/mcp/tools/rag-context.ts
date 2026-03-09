import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { ragBuildContext } from "../../core/context/rag-context.js";

export function registerRagContext(server: McpServer, store: SqliteStore): void {
  server.tool(
    "rag_context",
    "Build a RAG context from a natural language query. Returns relevant nodes with expanded subgraph context, managed within a token budget.",
    {
      query: z.string().describe("Natural language query to search for"),
      tokenBudget: z
        .number()
        .int()
        .min(500)
        .max(32000)
        .optional()
        .describe("Maximum token budget for the context (default: 4000)"),
    },
    async ({ query, tokenBudget }) => {
      const ctx = ragBuildContext(store, query, tokenBudget ?? 4000);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(ctx, null, 2),
          },
        ],
      };
    },
  );
}
