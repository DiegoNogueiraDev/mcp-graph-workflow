/**
 * DreamEngine — Central orchestrator for REM-inspired knowledge consolidation.
 *
 * Runs a three-phase "sleep cycle":
 *   Phase 1 (NREM): Replay + Decay + Prune
 *   Phase 2 (REM):  Priority + Merge + Associate
 *   Phase 3 (Wake): Report + Synthesize + Cache Invalidation
 *
 * Emits events via GraphEventBus at each phase boundary.
 * Persists results via dream-store.
 */

import type Database from "better-sqlite3";
import type { DreamCycleConfig, DreamCycleResult, DreamStatus, DreamPhase } from "./dream-types.js";
import { DreamCycleConfigSchema, DEFAULT_DREAM_CONFIG } from "./dream-types.js";
import { saveDreamCycle, updateDreamCycle } from "./dream-store.js";
import { runNremPhase } from "./phases/nrem-phase.js";
import { runRemPhase } from "./phases/rem-phase.js";
import { runWakeReadyPhase } from "./phases/wake-ready-phase.js";
import { GraphEventBus } from "../events/event-bus.js";
import type { GraphEvent } from "../events/event-types.js";
import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

export class DreamEngine {
  private db: Database.Database;
  private eventBus: GraphEventBus;
  private running = false;
  private currentPhase: DreamPhase | undefined;
  private currentCycleId: string | undefined;
  private cancelled = false;

  constructor(db: Database.Database, eventBus: GraphEventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  /**
   * Run a complete dream cycle (NREM → REM → Wake).
   */
  async runCycle(configOverrides?: Partial<DreamCycleConfig>): Promise<DreamCycleResult> {
    const config = DreamCycleConfigSchema.parse({ ...DEFAULT_DREAM_CONFIG, ...configOverrides });
    const cycleId = generateId("dream");
    this.running = true;
    this.currentCycleId = cycleId;
    this.cancelled = false;

    const startedAt = new Date().toISOString();

    // Capture before-metrics
    const beforeMetrics = this.getBeforeMetrics();

    // Persist initial cycle record
    const initialResult: DreamCycleResult = {
      id: cycleId,
      startedAt,
      completedAt: "",
      status: "running",
      config,
      phases: {
        nrem: { replayed: 0, scoresDecayed: 0, pruned: 0, archived: 0, durationMs: 0 },
        rem: { priorityProcessed: 0, urgencyDecayed: 0, merged: 0, clustersFormed: 0, associationsCreated: 0, durationMs: 0 },
        wakeReady: { freedTokens: 0, signalToNoise: 0, newGeneralizations: 0, durationMs: 0 },
      },
      summary: {
        totalDocsBefore: beforeMetrics.totalDocs,
        totalDocsAfter: 0,
        avgQualityBefore: beforeMetrics.avgQuality,
        avgQualityAfter: 0,
        totalPruned: 0,
        totalMerged: 0,
        totalAssociations: 0,
        freedCapacityEstimate: 0,
      },
    };

    if (!config.dryRun) {
      saveDreamCycle(this.db, initialResult);
    }

    this.emitEvent("dream:cycle_started", { cycleId, config: config as unknown as Record<string, unknown> });

    try {
      // ── Phase 1: NREM ──────────────────────────────────
      this.currentPhase = "nrem";
      this.emitEvent("dream:phase_started", { cycleId, phase: "nrem" });
      const nremResult = runNremPhase(this.db, config, cycleId);
      this.emitEvent("dream:phase_completed", { cycleId, phase: "nrem", durationMs: nremResult.durationMs });

      if (this.cancelled) return this.buildCancelledResult(cycleId, startedAt, config, nremResult, initialResult);

      // ── Phase 2: REM ───────────────────────────────────
      this.currentPhase = "rem";
      this.emitEvent("dream:phase_started", { cycleId, phase: "rem" });
      const remResult = runRemPhase(this.db, config, cycleId);
      this.emitEvent("dream:phase_completed", { cycleId, phase: "rem", durationMs: remResult.durationMs });

      if (this.cancelled) return this.buildCancelledResult(cycleId, startedAt, config, nremResult, initialResult);

      // ── Phase 3: Wake Ready ────────────────────────────
      this.currentPhase = "wake-ready";
      this.emitEvent("dream:phase_started", { cycleId, phase: "wake-ready" });
      const wakeResult = runWakeReadyPhase(this.db, {
        totalDocsBefore: beforeMetrics.totalDocs,
        avgQualityBefore: beforeMetrics.avgQuality,
      });
      this.emitEvent("dream:phase_completed", { cycleId, phase: "wake-ready", durationMs: wakeResult.durationMs });

      // ── Build final result ─────────────────────────────
      const afterMetrics = this.getBeforeMetrics();
      const completedAt = new Date().toISOString();
      const totalDurationMs = nremResult.durationMs + remResult.durationMs + wakeResult.durationMs;

      const result: DreamCycleResult = {
        id: cycleId,
        startedAt,
        completedAt,
        status: "completed",
        config,
        phases: { nrem: nremResult, rem: remResult, wakeReady: wakeResult },
        summary: {
          totalDocsBefore: beforeMetrics.totalDocs,
          totalDocsAfter: afterMetrics.totalDocs,
          avgQualityBefore: beforeMetrics.avgQuality,
          avgQualityAfter: afterMetrics.avgQuality,
          totalPruned: nremResult.pruned,
          totalMerged: remResult.merged,
          totalAssociations: remResult.associationsCreated,
          freedCapacityEstimate: wakeResult.freedTokens,
        },
      };

      if (!config.dryRun) {
        updateDreamCycle(this.db, result);
      }

      this.emitEvent("dream:cycle_completed", {
        cycleId,
        totalPruned: nremResult.pruned,
        totalMerged: remResult.merged,
        durationMs: totalDurationMs,
      });

      logger.info("dream:cycle:complete", { cycleId, durationMs: totalDurationMs });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.emitEvent("dream:cycle_failed", { cycleId, errorMessage });
      logger.error("dream:cycle:failed", { cycleId, error: errorMessage });
      throw err;
    } finally {
      this.running = false;
      this.currentPhase = undefined;
      this.currentCycleId = undefined;
    }
  }

  /**
   * Cancel a running cycle. The cycle will stop after the current phase.
   */
  cancelCycle(): void {
    this.cancelled = true;
    logger.info("dream:cycle:cancel_requested", { cycleId: this.currentCycleId });
  }

  /**
   * Get current engine status.
   */
  getStatus(): DreamStatus {
    return {
      running: this.running,
      currentPhase: this.currentPhase,
      progress: this.running ? this.estimateProgress() : undefined,
      cycleId: this.currentCycleId,
    };
  }

  // ── Private helpers ────────────────────────────────────

  private getBeforeMetrics(): { totalDocs: number; avgQuality: number } {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt, COALESCE(AVG(quality_score), 0) as avg_q FROM knowledge_documents")
      .get() as { cnt: number; avg_q: number };
    return { totalDocs: row.cnt, avgQuality: row.avg_q };
  }

  private estimateProgress(): number {
    if (!this.currentPhase) return 0;
    const phaseProgress: Record<DreamPhase, number> = {
      "nrem": 0.33,
      "rem": 0.66,
      "wake-ready": 0.9,
    };
    return phaseProgress[this.currentPhase] ?? 0;
  }

  private emitEvent(type: GraphEvent["type"], payload: Record<string, unknown>): void {
    this.eventBus.emit({
      type,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  private buildCancelledResult(
    cycleId: string,
    startedAt: string,
    config: DreamCycleConfig,
    nremResult: DreamCycleResult["phases"]["nrem"],
    initial: DreamCycleResult,
  ): DreamCycleResult {
    return {
      ...initial,
      id: cycleId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "cancelled",
      config,
      phases: { ...initial.phases, nrem: nremResult },
    };
  }
}
