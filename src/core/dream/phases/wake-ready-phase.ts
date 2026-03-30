/**
 * Wake Ready Phase — Capacity Report + Signal-to-Noise + Generalization
 *
 * Biological basis:
 * - After sleep cycles, the brain wakes with freed synaptic capacity,
 *   improved signal-to-noise, and new cross-memory generalizations
 *   formed during REM self-organization.
 */

import type Database from "better-sqlite3";
import type { WakeReadyResult } from "../dream-types.js";
import { estimateTokens } from "../../context/token-estimator.js";
import { runSynthesisCycle } from "../../rag/knowledge-synthesizer.js";
import { logger } from "../../utils/logger.js";

interface BeforeMetrics {
  totalDocsBefore: number;
  avgQualityBefore: number;
}

/**
 * Run the Wake Ready phase of a dream cycle.
 *
 * 1. Capacity Report: count docs and estimate freed tokens
 * 2. Signal-to-Noise: compare avg quality before vs after
 * 3. Generalization: run synthesis to create cross-memory docs
 */
export function runWakeReadyPhase(
  db: Database.Database,
  before: BeforeMetrics,
): WakeReadyResult {
  const startMs = Date.now();

  // ── 1. Capacity Report ──────────────────────────────────
  const currentStats = getCurrentStats(db);
  const docsRemoved = Math.max(0, before.totalDocsBefore - currentStats.totalDocs);
  const freedTokens = docsRemoved > 0 ? estimateFreedTokens(db, docsRemoved) : 0;

  // ── 2. Signal-to-Noise ─────────────────────────────────
  let signalToNoise = 0;
  if (before.avgQualityBefore > 0 && currentStats.avgQuality > 0) {
    signalToNoise = currentStats.avgQuality / before.avgQualityBefore;
  }

  // ── 3. Generalization (synthesis) ──────────────────────
  let newGeneralizations = 0;
  try {
    const synthesisResult = runSynthesisCycle(db);
    newGeneralizations = synthesisResult.synthesized;
  } catch {
    logger.debug("dream:wake:synthesis_skipped", { reason: "insufficient docs or no patterns" });
  }

  const durationMs = Date.now() - startMs;
  logger.info("dream:wake:complete", { freedTokens, signalToNoise, newGeneralizations, durationMs });

  return { freedTokens, signalToNoise, newGeneralizations, durationMs };
}

/**
 * Get current doc count and average quality score.
 */
function getCurrentStats(db: Database.Database): { totalDocs: number; avgQuality: number } {
  const row = db
    .prepare("SELECT COUNT(*) as cnt, COALESCE(AVG(quality_score), 0) as avg_q FROM knowledge_documents")
    .get() as { cnt: number; avg_q: number };
  return { totalDocs: row.cnt, avgQuality: row.avg_q };
}

/**
 * Estimate tokens freed by removed docs.
 * Uses average content length * docs removed * token estimation.
 */
function estimateFreedTokens(db: Database.Database, docsRemoved: number): number {
  const row = db
    .prepare("SELECT COALESCE(AVG(LENGTH(content)), 0) as avg_len FROM knowledge_documents")
    .get() as { avg_len: number };
  const avgContentLength = Math.round(row.avg_len);
  return docsRemoved * estimateTokens("x".repeat(avgContentLength));
}
