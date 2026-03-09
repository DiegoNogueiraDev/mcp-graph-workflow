import { Router } from "express";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";
import { estimateTokens } from "../../core/context/token-estimator.js";
import { detectCycles } from "../../core/planner/dependency-chain.js";

export function createBenchmarkRouter(store: SqliteStore): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      const stats = store.getStats();
      const doc = store.toGraphDocument();
      const allNodes = doc.nodes;
      const allEdges = doc.edges;

      // Per-task metrics via buildTaskContext
      const perTaskMetrics: Array<{
        id: string;
        title: string;
        rawChars: number;
        compactChars: number;
        compressionPercent: number;
        estimatedTokens: number;
        estimatedTokensSaved: number;
      }> = [];

      for (const node of allNodes) {
        if (node.type !== "task" && node.type !== "subtask") continue;
        const ctx = buildTaskContext(store, node.id);
        if (!ctx) continue;

        const rawTokens = estimateTokens(String(ctx.metrics.originalChars));
        perTaskMetrics.push({
          id: node.id,
          title: node.title,
          rawChars: ctx.metrics.originalChars,
          compactChars: ctx.metrics.compactChars,
          compressionPercent: ctx.metrics.reductionPercent,
          estimatedTokens: ctx.metrics.estimatedTokens,
          estimatedTokensSaved: Math.max(0, rawTokens - ctx.metrics.estimatedTokens),
        });
      }

      // Averages
      const sampleSize = perTaskMetrics.length;
      const avgCompressionPercent = sampleSize > 0
        ? Math.round(perTaskMetrics.reduce((s, m) => s + m.compressionPercent, 0) / sampleSize)
        : 0;
      const totalTokensSaved = perTaskMetrics.reduce((s, m) => s + m.estimatedTokensSaved, 0);
      const avgTokensPerTask = sampleSize > 0
        ? Math.round(perTaskMetrics.reduce((s, m) => s + m.estimatedTokens, 0) / sampleSize)
        : 0;

      // Dependency intelligence
      const inferredDeps = allEdges.filter((e) => e.metadata?.inferred === true).length;
      const blockedTasks = allNodes.filter((n) => n.blocked === true).length;
      const cycles = detectCycles(doc);

      // Cost calculations
      const opusInputPrice = 15.0; // $/MTok
      const sonnetInputPrice = 3.0; // $/MTok
      const opusPerTask = avgTokensPerTask > 0 ? (avgTokensPerTask * opusInputPrice) / 1_000_000 : 0;
      const sonnetPerTask = avgTokensPerTask > 0 ? (avgTokensPerTask * sonnetInputPrice) / 1_000_000 : 0;

      res.json({
        tokenEconomy: {
          totalNodes: stats.totalNodes,
          totalEdges: stats.totalEdges,
          avgCompressionPercent,
          sampleSize,
          perTaskMetrics,
          totalTokensSaved,
          avgTokensPerTask,
          costSavings: {
            opusPerTask: Math.round(opusPerTask * 1000) / 1000,
            sonnetPerTask: Math.round(sonnetPerTask * 1000) / 1000,
          },
        },
        dependencyIntelligence: {
          totalEdges: stats.totalEdges,
          inferredDeps,
          blockedTasks,
          cycles: cycles.length,
        },
        formulas: {
          compressionPercent: "1 - (compactChars / rawChars) * 100",
          tokenEstimate: "ceil(chars / 4) — industry standard ~4 chars/token",
          tokensSavedPerTask: "estimateTokens(rawChars) - estimateTokens(compactChars)",
          costPerTask: "tokens * pricePerMTok / 1_000_000",
          opusInputPrice: "$15.00/MTok",
          sonnetInputPrice: "$3.00/MTok",
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
