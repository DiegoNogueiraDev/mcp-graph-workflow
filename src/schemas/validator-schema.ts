import { z } from "zod/v4";
import { AdrGradeSchema, ReadinessSeveritySchema } from "./designer-schema.js";

// ── Done Integrity ──

export const DoneIntegrityIssueTypeSchema = z.enum([
  "blocked_but_done",
  "dependency_not_done",
]);

export const DoneIntegrityIssueSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  issueType: DoneIntegrityIssueTypeSchema,
  details: z.string(),
});

export const DoneIntegrityReportSchema = z.object({
  issues: z.array(DoneIntegrityIssueSchema),
  passed: z.boolean(),
  info: z.string().optional(),
});

// ── Status Flow ──

export const StatusFlowViolationSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  currentStatus: z.string(),
  details: z.string(),
});

export const StatusFlowReportSchema = z.object({
  violations: z.array(StatusFlowViolationSchema),
  complianceRate: z.number().min(0).max(100),
});

// ── Validation Readiness (composite) ──

export const ValidationReadinessCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  details: z.string(),
  severity: ReadinessSeveritySchema,
});

export const ValidationReadinessReportSchema = z.object({
  checks: z.array(ValidationReadinessCheckSchema),
  ready: z.boolean(),
  score: z.number().min(0).max(100),
  grade: AdrGradeSchema,
  summary: z.string(),
});

export type DoneIntegrityIssueType = z.infer<typeof DoneIntegrityIssueTypeSchema>;
export type DoneIntegrityIssue = z.infer<typeof DoneIntegrityIssueSchema>;
export type DoneIntegrityReport = z.infer<typeof DoneIntegrityReportSchema>;
export type StatusFlowViolation = z.infer<typeof StatusFlowViolationSchema>;
export type StatusFlowReport = z.infer<typeof StatusFlowReportSchema>;
export type ValidationReadinessCheck = z.infer<typeof ValidationReadinessCheckSchema>;
export type ValidationReadinessReport = z.infer<typeof ValidationReadinessReportSchema>;
