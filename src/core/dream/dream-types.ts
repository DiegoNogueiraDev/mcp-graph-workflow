import { z } from "zod/v4";

// ─── Dream Phase (maps to biological sleep phases) ───

export const DreamPhaseSchema = z.enum(["nrem", "rem", "wake-ready"]);
export type DreamPhase = z.infer<typeof DreamPhaseSchema>;

// ─── Dream Cycle Status ───

export const DreamCycleStatusSchema = z.enum([
  "idle",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type DreamCycleStatus = z.infer<typeof DreamCycleStatusSchema>;

// ─── Dream Cycle Config (tunable parameters) ───

export const DreamCycleConfigSchema = z.object({
  /** Quality score below which docs are pruned (0-1) */
  pruneThreshold: z.number().min(0).max(1).default(0.15),
  /** Proportional downscale factor per cycle (0-1) */
  decayFactor: z.number().min(0).max(1).default(0.85),
  /** Separate urgency decay factor (0-1) */
  urgencyDecayFactor: z.number().min(0).max(1).default(0.7),
  /** Max docs to replay per NREM phase */
  maxReplayBatch: z.number().int().positive().default(200),
  /** Cosine similarity threshold for merging (0-1) */
  mergeSimThreshold: z.number().min(0).max(1).default(0.92),
  /** Co-access association strength boost (0-0.5) */
  associationBoostFactor: z.number().min(0).max(0.5).default(0.1),
  /** Preview mode — no mutations */
  dryRun: z.boolean().default(false),
});
export type DreamCycleConfig = z.infer<typeof DreamCycleConfigSchema>;

export const DEFAULT_DREAM_CONFIG: DreamCycleConfig = DreamCycleConfigSchema.parse({});

// ─── Phase Results ───

export const NremPhaseResultSchema = z.object({
  /** Docs replayed (recordAccess called) */
  replayed: z.number().int().min(0),
  /** Docs with quality scores downscaled */
  scoresDecayed: z.number().int().min(0),
  /** Docs below threshold removed */
  pruned: z.number().int().min(0),
  /** Docs archived (soft-deleted) */
  archived: z.number().int().min(0),
  /** Phase duration in milliseconds */
  durationMs: z.number().min(0),
});
export type NremPhaseResult = z.infer<typeof NremPhaseResultSchema>;

export const RemPhaseResultSchema = z.object({
  /** Error/blocker tagged items re-consolidated */
  priorityProcessed: z.number().int().min(0),
  /** Urgency signals decayed */
  urgencyDecayed: z.number().int().min(0),
  /** Similar entries merged */
  merged: z.number().int().min(0),
  /** Re-clustering result */
  clustersFormed: z.number().int().min(0),
  /** Co-access links strengthened */
  associationsCreated: z.number().int().min(0),
  /** Phase duration in milliseconds */
  durationMs: z.number().min(0),
});
export type RemPhaseResult = z.infer<typeof RemPhaseResultSchema>;

export const WakeReadyResultSchema = z.object({
  /** Estimated tokens freed */
  freedTokens: z.number().min(0),
  /** Before/after quality ratio */
  signalToNoise: z.number().min(0),
  /** Cross-memory synthesis docs created */
  newGeneralizations: z.number().int().min(0),
  /** Phase duration in milliseconds */
  durationMs: z.number().min(0),
});
export type WakeReadyResult = z.infer<typeof WakeReadyResultSchema>;

// ─── Dream Summary ───

export const DreamSummarySchema = z.object({
  totalDocsBefore: z.number().int().min(0),
  totalDocsAfter: z.number().int().min(0),
  avgQualityBefore: z.number().min(0).max(1),
  avgQualityAfter: z.number().min(0).max(1),
  totalPruned: z.number().int().min(0),
  totalMerged: z.number().int().min(0),
  totalAssociations: z.number().int().min(0),
  freedCapacityEstimate: z.number().min(0),
});
export type DreamSummary = z.infer<typeof DreamSummarySchema>;

// ─── Dream Cycle Result ───

export const DreamCycleResultSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  status: DreamCycleStatusSchema,
  config: DreamCycleConfigSchema,
  phases: z.object({
    nrem: NremPhaseResultSchema,
    rem: RemPhaseResultSchema,
    wakeReady: WakeReadyResultSchema,
  }),
  summary: DreamSummarySchema,
});
export type DreamCycleResult = z.infer<typeof DreamCycleResultSchema>;

// ─── Dream Status (runtime state) ───

export const DreamStatusSchema = z.object({
  running: z.boolean(),
  currentPhase: DreamPhaseSchema.optional(),
  progress: z.number().min(0).max(1).optional(),
  cycleId: z.string().optional(),
});
export type DreamStatus = z.infer<typeof DreamStatusSchema>;
