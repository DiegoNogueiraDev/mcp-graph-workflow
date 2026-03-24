/**
 * Benchmark Indexer — indexes performance benchmark results as knowledge documents.
 * Enables RAG queries about performance metrics, token economy, and SLA compliance.
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

export interface BenchmarkMetric {
  name: string;
  value: number;
  target: number;
  passed: boolean;
}

export interface BenchmarkData {
  timestamp: string;
  metrics: BenchmarkMetric[];
  tokenEconomy?: {
    avgCompression: number;
    totalTokensSaved: number;
  };
  toolUsage?: Record<string, { inputTokens: number; outputTokens: number }>;
}

export interface BenchmarkIndexResult {
  documentsIndexed: number;
}

/**
 * Index benchmark results into the knowledge store.
 * Creates documents for metrics summary and token economy.
 */
export function indexBenchmarkResults(
  store: KnowledgeStore,
  data: BenchmarkData,
): BenchmarkIndexResult {
  let documentsIndexed = 0;

  // Index metrics summary
  if (data.metrics.length > 0) {
    const metricsLines = data.metrics.map((m) => {
      const status = m.passed ? "PASSED" : "FAILED — exceeded target";
      return `- ${m.name}: ${m.value} (target: ${m.target}) [${status}]`;
    });

    const passing = data.metrics.filter((m) => m.passed).length;
    const failing = data.metrics.length - passing;

    const content = [
      `## Benchmark Results (${data.timestamp})`,
      "",
      `Summary: ${passing} passed, ${failing} failed out of ${data.metrics.length} metrics.`,
      "",
      ...metricsLines,
    ].join("\n");

    store.insert({
      sourceType: "benchmark",
      sourceId: `benchmark:${data.timestamp}`,
      title: `Benchmark Results ${data.timestamp}`,
      content,
      chunkIndex: 0,
      metadata: {
        timestamp: data.timestamp,
        totalMetrics: data.metrics.length,
        passing,
        failing,
      },
    });
    documentsIndexed++;
  }

  // Index token economy
  if (data.tokenEconomy) {
    const content = [
      `## Token Economy (${data.timestamp})`,
      "",
      `- Average compression ratio: ${data.tokenEconomy.avgCompression}`,
      `- Total tokens saved: ${data.tokenEconomy.totalTokensSaved}`,
    ].join("\n");

    store.insert({
      sourceType: "benchmark",
      sourceId: `benchmark:token-economy:${data.timestamp}`,
      title: `Token Economy ${data.timestamp}`,
      content,
      chunkIndex: 0,
      metadata: {
        timestamp: data.timestamp,
        avgCompression: data.tokenEconomy.avgCompression,
        totalTokensSaved: data.tokenEconomy.totalTokensSaved,
      },
    });
    documentsIndexed++;
  }

  // Index tool usage
  if (data.toolUsage && Object.keys(data.toolUsage).length > 0) {
    const lines = Object.entries(data.toolUsage).map(
      ([tool, usage]) =>
        `- ${tool}: input=${usage.inputTokens}, output=${usage.outputTokens}`,
    );

    const content = [
      `## Tool Token Usage (${data.timestamp})`,
      "",
      ...lines,
    ].join("\n");

    store.insert({
      sourceType: "benchmark",
      sourceId: `benchmark:tool-usage:${data.timestamp}`,
      title: `Tool Token Usage ${data.timestamp}`,
      content,
      chunkIndex: 0,
      metadata: { timestamp: data.timestamp },
    });
    documentsIndexed++;
  }

  logger.info("Benchmark results indexed", { documentsIndexed, timestamp: data.timestamp });

  return { documentsIndexed };
}
