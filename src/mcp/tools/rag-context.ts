import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { ragBuildContext } from "../../core/context/rag-context.js";
import { assembleContext } from "../../core/context/context-assembler.js";
import { detectCurrentPhase, type LifecyclePhase } from "../../core/planner/lifecycle-phase.js";
import { logger } from "../../core/utils/logger.js";

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
      logger.debug("tool:rag_context", { query, tier: detail });
      const budget = tokenBudget ?? 4000;

      // Detect current lifecycle phase for phase-aware knowledge boosting
      let currentPhase: LifecyclePhase | undefined;
      try {
        const doc = store.toGraphDocument();
        const phaseOverride = store.getProjectSetting("lifecycle_phase_override");
        currentPhase = detectCurrentPhase(doc, {
          phaseOverride: phaseOverride ? phaseOverride as LifecyclePhase : null,
        });
      } catch {
        // Phase detection may fail if no project loaded — proceed without phase
        logger.debug("tool:rag_context:phase_detection_skipped");
      }

      if (detail) {
        // Use tiered context assembler with phase awareness
        const ctx = assembleContext(store, query, {
          tokenBudget: budget,
          tier: detail,
          phase: currentPhase,
        });

        logger.info("tool:rag_context:ok", { query, tier: detail, phase: currentPhase });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(ctx, null, 2),
            },
          ],
        };
      }

      // Default: use existing RAG context builder with phase awareness
      const ctx = ragBuildContext(store, query, budget, currentPhase);

      logger.info("tool:rag_context:ok", { query, tier: "standard", phase: currentPhase });
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
