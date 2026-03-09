import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { ragBuildContext } from "../../core/context/rag-context.js";
import { assembleContext } from "../../core/context/context-assembler.js";

export function registerRagContext(server: McpServer, store: SqliteStore): void {
  server.tool(
    "rag_context",
    "Build a RAG context from a natural language query. Returns relevant nodes with expanded subgraph context, managed within a token budget. Supports detail levels: summary (~20 tok/node), standard (~150 tok/node), deep (~500+ tok/node with knowledge).",
    {
      query: z.string().describe("Natural language query to search for"),
      tokenBudget: z
        .number()
        .int()
        .min(500)
        .max(32000)
        .optional()
        .describe("Maximum token budget for the context (default: 4000)"),
      detail: z
        .enum(["summary", "standard", "deep"])
        .optional()
        .describe("Context detail level: summary (~20 tok/node), standard (~150 tok/node), deep (~500+ tok/node). Default: standard"),
    },
    async ({ query, tokenBudget, detail }) => {
      const budget = tokenBudget ?? 4000;

      if (detail) {
        // Use tiered context assembler
        const ctx = assembleContext(store, query, {
          tokenBudget: budget,
          tier: detail,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(ctx, null, 2),
            },
          ],
        };
      }

      // Default: use existing RAG context builder (backward compatible)
      const ctx = ragBuildContext(store, query, budget);

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
