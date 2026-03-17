import { z } from "zod/v4";

// ── PRD Quality ──

export const SectionQualitySchema = z.enum(["missing", "weak", "adequate", "strong"]);

export const PrdQualitySectionSchema = z.object({
  name: z.string(),
  quality: SectionQualitySchema,
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export const PrdQualityGradeSchema = z.enum(["A", "B", "C", "D", "F"]);

export const PrdQualityReportSchema = z.object({
  score: z.number().min(0).max(100),
  grade: PrdQualityGradeSchema,
  sections: z.array(PrdQualitySectionSchema),
  readyForDesign: z.boolean(),
  summary: z.string(),
});

export type PrdQualityReport = z.infer<typeof PrdQualityReportSchema>;
export type PrdQualitySection = z.infer<typeof PrdQualitySectionSchema>;
export type SectionQuality = z.infer<typeof SectionQualitySchema>;
export type PrdQualityGrade = z.infer<typeof PrdQualityGradeSchema>;

// ── Scope Analysis ──

export const OrphanNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  reason: z.string(),
});

export const CoverageMatrixSchema = z.object({
  requirementsToTasks: z.number().min(0).max(100),
  tasksToAc: z.number().min(0).max(100),
  orphanRequirements: z.number(),
  orphanTasks: z.number(),
});

export const ScopeAnalysisSchema = z.object({
  orphans: z.array(OrphanNodeSchema),
  cycles: z.array(z.array(z.string())),
  coverage: CoverageMatrixSchema,
  conflicts: z.array(z.string()),
  summary: z.string(),
});

export type ScopeAnalysis = z.infer<typeof ScopeAnalysisSchema>;
export type OrphanNode = z.infer<typeof OrphanNodeSchema>;
export type CoverageMatrix = z.infer<typeof CoverageMatrixSchema>;

// ── Definition of Ready ──

export const ReadinessCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  details: z.string(),
});

export const ReadinessReportSchema = z.object({
  readyForNextPhase: z.boolean(),
  checks: z.array(ReadinessCheckSchema),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  summary: z.string(),
});

export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;
export type ReadinessCheck = z.infer<typeof ReadinessCheckSchema>;

// ── Risk Assessment ──

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const RiskEntrySchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  probability: z.number().min(1).max(5),
  impact: z.number().min(1).max(5),
  score: z.number(),
  level: RiskLevelSchema,
  mitigationStatus: z.enum(["mitigated", "partial", "unmitigated"]),
  suggestedMitigation: z.string().optional(),
});

export const RiskMatrixSchema = z.object({
  risks: z.array(RiskEntrySchema),
  summary: z.object({
    total: z.number(),
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
    mitigated: z.number(),
  }),
});

export type RiskMatrix = z.infer<typeof RiskMatrixSchema>;
export type RiskEntry = z.infer<typeof RiskEntrySchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
