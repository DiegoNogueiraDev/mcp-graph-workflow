import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { buildTaskContext, computeLayeredMetrics, type LayeredTokenMetrics } from "../../core/context/compact-context.js";
import { detectCycles } from "../../core/planner/dependency-chain.js";
import { ToolTokenStore, type ToolTokenSummary } from "../../core/store/tool-token-store.js";

export function createBenchmarkRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      const store = storeRef.current;
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
        layered?: LayeredTokenMetrics;
      }> = [];

      const layeredSamples: LayeredTokenMetrics[] = [];

      for (const node of allNodes) {
        if (node.type !== "task" && node.type !== "subtask") continue;
        const ctx = buildTaskContext(store, node.id);
        if (!ctx) continue;

        const rawTokens = Math.ceil(ctx.metrics.originalChars / 4);
        const layered = computeLayeredMetrics(store, node.id) ?? undefined;
        if (layered) layeredSamples.push(layered);

        perTaskMetrics.push({
          id: node.id,
          title: node.title,
          rawChars: ctx.metrics.originalChars,
          compactChars: ctx.metrics.compactChars,
          compressionPercent: ctx.metrics.reductionPercent,
          estimatedTokens: ctx.metrics.estimatedTokens,
          estimatedTokensSaved: Math.max(0, rawTokens - ctx.metrics.estimatedTokens),
          layered,
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

      // Layered compression aggregate
      const avg = (fn: (l: LayeredTokenMetrics) => number): number =>
        Math.round(layeredSamples.reduce((s, l) => s + fn(l), 0) / layeredSamples.length);
      const avgPct = (savingsKey: "layer1Savings" | "layer2Savings" | "layer3Savings" | "layer4Savings"): number =>
        avg((l) => l.naiveNeighborhoodTokens > 0 ? (l[savingsKey] / l.naiveNeighborhoodTokens) * 100 : 0);

      const layeredCompression = layeredSamples.length > 0 ? {
        avgNaiveNeighborhoodTokens: avg((l) => l.naiveNeighborhoodTokens),
        avgCompactContextTokens: avg((l) => l.compactContextTokens),
        avgNeighborTruncatedTokens: avg((l) => l.neighborTruncatedTokens),
        avgDefaultOmittedTokens: avg((l) => l.defaultOmittedTokens),
        avgShortKeysTokens: avg((l) => l.shortKeysTokens),
        avgSummaryTierTokens: avg((l) => l.summaryTierTokens),
        avgLayer1SavingsPercent: avgPct("layer1Savings"),
        avgLayer2SavingsPercent: avgPct("layer2Savings"),
        avgLayer3SavingsPercent: avgPct("layer3Savings"),
        avgLayer4SavingsPercent: avgPct("layer4Savings"),
        avgTotalRealSavingsPercent: avg((l) => l.totalRealSavingsPercent),
        sampleSize: layeredSamples.length,
      } : null;

      // Dependency intelligence
      const inferredDeps = allEdges.filter((e) => e.metadata?.inferred === true).length;
      const blockedTasks = allNodes.filter((n) => n.blocked === true).length;
      const cycles = detectCycles(doc);

      // Cost calculations
      const opusInputPrice = 15.0; // $/MTok
      const sonnetInputPrice = 3.0; // $/MTok
      const opusPerTask = avgTokensPerTask > 0 ? (avgTokensPerTask * opusInputPrice) / 1_000_000 : 0;
      const sonnetPerTask = avgTokensPerTask > 0 ? (avgTokensPerTask * sonnetInputPrice) / 1_000_000 : 0;

      // Tool token usage — nullable for backward compatibility
      let toolTokenUsage: ToolTokenSummary | null = null;
      try {
        const project = store.getActiveProject();
        if (project) {
          const tokenStore = new ToolTokenStore(store.getDb());
          toolTokenUsage = tokenStore.getSummary(project.id);
        }
      } catch {
        // Pre-migration: table may not exist yet
      }

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
        layeredCompression,
        dependencyIntelligence: {
          totalEdges: stats.totalEdges,
          inferredDeps,
          blockedTasks,
          cycles: cycles.length,
        },
        toolTokenUsage,
        formulas: {
          compressionPercent: "1 - (compactChars / rawChars) * 100 — vs full graph (inflated baseline)",
          tokenEstimate: "ceil(chars / 4) — industry standard ~4 chars/token",
          tokensSavedPerTask: "estimateTokens(rawChars) - estimateTokens(compactChars)",
          costPerTask: "tokens * pricePerMTok / 1_000_000",
          opusInputPrice: "$15.00/MTok",
          sonnetInputPrice: "$3.00/MTok",
          toolInputTokens: "ceil(JSON.stringify(args).length / 4)",
          toolOutputTokens: "ceil(responseContentText.length / 4)",
          layer1Savings: "naiveNeighborhood - compactContext (field stripping)",
          layer2Savings: "compactContext - neighborTruncated (neighbor desc truncation to 100 chars)",
          layer3Savings: "neighborTruncated - defaultOmitted (omit priority:3, status:backlog, inferred:false, resolved:false)",
          layer4Savings: "defaultOmitted - shortKeys (JSON key abbreviation)",
          totalRealSavings: "naiveNeighborhoodTokens - summaryTierTokens (honest baseline)",
          keyLegend: "i=id, t=type, n=title, s=status, p=priority, d=description, tk=task, par=parent, ch=children, bl=blockers, dep=dependsOn, ac=acceptanceCriteria, sr=sourceRef, rt=relationType, inf=inferred, res=resolved",
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
