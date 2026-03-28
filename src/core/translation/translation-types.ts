import { z } from "zod/v4";

// --- Translation Job Status ---

export const TranslationJobStatusSchema = z.enum([
  "pending", "analyzing", "translating", "validating", "done", "failed",
]);

export type TranslationJobStatus = z.infer<typeof TranslationJobStatusSchema>;

// --- Translation Scope ---

export const TranslationScopeSchema = z.enum(["snippet", "function", "module"]);

export type TranslationScope = z.infer<typeof TranslationScopeSchema>;

// --- Translation Job ---

export const TranslationJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  sourceCode: z.string(),
  targetCode: z.string().optional(),
  status: TranslationJobStatusSchema,
  scope: TranslationScopeSchema,
  constraints: z.record(z.string(), z.unknown()).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TranslationJob = z.infer<typeof TranslationJobSchema>;

// --- Translation Construct Info (per-construct in analysis) ---

export const TranslationConstructInfoSchema = z.object({
  canonicalName: z.string(),
  count: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

export type TranslationConstructInfo = z.infer<typeof TranslationConstructInfoSchema>;

// --- Translation Analysis ---

export const TranslationAnalysisSchema = z.object({
  detectedLanguage: z.string(),
  detectedConfidence: z.number().min(0).max(1).optional(),
  constructs: z.array(TranslationConstructInfoSchema),
  complexityScore: z.number().min(0).max(1),
  estimatedTranslatability: z.number().min(0).max(1),
  ambiguousConstructs: z.array(z.string()).optional(),
  totalConstructs: z.number().int().min(0),
});

export type TranslationAnalysis = z.infer<typeof TranslationAnalysisSchema>;

// --- Translation Metrics ---

export const TranslationMetricsSchema = z.object({
  parseSuccess: z.boolean(),
  lintSuccess: z.boolean(),
  typeCheckSuccess: z.boolean(),
  ruleCoverage: z.number().min(0).max(1),
  templateCoverage: z.number().min(0).max(1),
  llmInterventions: z.number().int().min(0),
  tokensConsumed: z.number().int().min(0),
  totalTimeMs: z.number().int().min(0),
});

export type TranslationMetrics = z.infer<typeof TranslationMetricsSchema>;

// --- Translation Mapping Report (per-construct in result) ---

export const TranslationMappingReportSchema = z.object({
  sourceConstruct: z.string(),
  targetConstruct: z.string(),
  method: z.enum(["rule", "template", "llm"]),
  confidence: z.number().min(0).max(1),
});

export type TranslationMappingReport = z.infer<typeof TranslationMappingReportSchema>;

// --- Translation Result ---

export const TranslationResultSchema = z.object({
  targetCode: z.string(),
  mappingReport: z.array(TranslationMappingReportSchema),
  warnings: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  repairIterations: z.number().int().min(0),
  metrics: TranslationMetricsSchema,
});

export type TranslationResult = z.infer<typeof TranslationResultSchema>;

// --- Evidence Pack ---

export const EvidenceTranslatedConstructSchema = z.object({
  source: z.string(),
  target: z.string(),
  method: z.enum(["rule", "template", "llm"]),
});

export const EvidenceRiskSchema = z.object({
  construct: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  message: z.string(),
});

export const EvidencePackSchema = z.object({
  diff: z.string(),
  translatedConstructs: z.array(EvidenceTranslatedConstructSchema),
  risks: z.array(EvidenceRiskSchema),
  confidenceScore: z.number().min(0).max(1),
  humanReviewPoints: z.array(z.string()),
});

export type EvidencePack = z.infer<typeof EvidencePackSchema>;
