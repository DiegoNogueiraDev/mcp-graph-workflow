import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { ragBuildContext } from "../../core/context/rag-context.js";
import { assembleContext } from "../../core/context/context-assembler.js";
import { multiStrategySearch } from "../../core/rag/multi-strategy-retrieval.js";
import { recordUsage } from "../../core/rag/knowledge-quality.js";
import { detectCurrentPhase, type LifecyclePhase } from "../../core/planner/lifecycle-phase.js";
import { DEFAULT_TOKEN_BUDGET } from "../../core/utils/constants.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

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
      strategy: z
        .enum(["fts", "multi"])
        .optional()
        .describe("Search strategy: 'fts' (traditional BM25), 'multi' (multi-strategy with quality + relations). Default: fts"),
    },
    async ({ query, tokenBudget, detail, strategy }) => {
      logger.debug("tool:rag_context", { query, tier: detail });
      const budget = tokenBudget ?? DEFAULT_TOKEN_BUDGET;

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

        logger.info("tool:rag_context:ok", { query, tier: detail, phase: currentPhase, strategy });
        return mcpText(ctx);
      }

      // Multi-strategy search mode
      if (strategy === "multi") {
        const multiResults = multiStrategySearch(store.getDb(), query, {
          limit: 10,
          phase: currentPhase,
        });

        // Record usage for retrieved docs
        try {
          for (const result of multiResults.slice(0, 5)) {
            recordUsage(store.getDb(), result.id, query, "retrieved", { tool: "rag_context", strategy: "multi" });
          }
        } catch {
          // Usage recording is best-effort
        }

        logger.info("tool:rag_context:ok", { query, strategy: "multi", phase: currentPhase, results: multiResults.length });
        return mcpText({
          query,
          strategy: "multi",
          results: multiResults.map((r) => ({
            id: r.id,
            sourceType: r.sourceType,
            title: r.title,
            content: r.content.length > 500 ? r.content.slice(0, 500) + "..." : r.content,
            score: r.score,
            qualityScore: r.qualityScore,
            strategies: r.strategies,
          })),
          tokenUsage: {
            budget,
            used: multiResults.reduce((sum, r) => sum + r.content.length / 4, 0),
            remaining: budget,
          },
        });
      }

      // Default: use existing RAG context builder with phase awareness
      const ctx = ragBuildContext(store, query, budget, currentPhase);

      logger.info("tool:rag_context:ok", { query, tier: "standard", phase: currentPhase });
      return mcpText(ctx);
    },
  );
}
