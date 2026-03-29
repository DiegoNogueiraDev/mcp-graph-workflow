import { z } from "zod/v4";

// --- Translation Project Status ---

export const TranslationProjectStatusSchema = z.enum([
  "uploading",
  "analyzing",
  "ready",
  "translating",
  "done",
  "failed",
]);

export type TranslationProjectStatus = z.infer<
  typeof TranslationProjectStatusSchema
>;

// --- Translation Project File Status ---

export const TranslationProjectFileStatusSchema = z.enum([
  "pending",
  "analyzing",
  "analyzed",
  "translating",
  "done",
  "failed",
]);

export type TranslationProjectFileStatus = z.infer<
  typeof TranslationProjectFileStatusSchema
>;

// --- Translation Project ---

export const TranslationProjectSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string(),
  status: TranslationProjectStatusSchema,
  totalFiles: z.number().int().min(0),
  processedFiles: z.number().int().min(0),
  overallConfidence: z.number().min(0).max(1).optional(),
  deterministicPct: z.number().min(0).max(100).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TranslationProject = z.infer<typeof TranslationProjectSchema>;

// --- Translation Project File ---

export const TranslationProjectFileSchema = z.object({
  id: z.string(),
  translationProjectId: z.string(),
  filePath: z.string(),
  sourceCode: z.string(),
  sourceLanguage: z.string().optional(),
  status: TranslationProjectFileStatusSchema,
  jobId: z.string().optional(),
  deterministic: z.boolean().optional(),
  analysis: z.record(z.string(), z.unknown()).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TranslationProjectFile = z.infer<
  typeof TranslationProjectFileSchema
>;

// --- Create Project Input ---

export const CreateTranslationProjectInputSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string(),
  totalFiles: z.number().int().min(0).optional(),
});

export type CreateTranslationProjectInput = z.infer<
  typeof CreateTranslationProjectInputSchema
>;

// --- Add File Input ---

export const AddTranslationProjectFileInputSchema = z.object({
  translationProjectId: z.string(),
  filePath: z.string(),
  sourceCode: z.string(),
  sourceLanguage: z.string().optional(),
});

export type AddTranslationProjectFileInput = z.infer<
  typeof AddTranslationProjectFileInputSchema
>;

// --- Extracted File (from ZIP) ---

export const ExtractedFileSchema = z.object({
  relativePath: z.string(),
  content: z.string(),
  extension: z.string(),
  sizeBytes: z.number().int().min(0),
  detectedLanguage: z.string().optional(),
});

export type ExtractedFile = z.infer<typeof ExtractedFileSchema>;

// --- Project Summary ---

export const TranslationProjectSummarySchema = z.object({
  overallConfidence: z.number().min(0).max(1),
  deterministicPct: z.number().min(0).max(100),
  totalFiles: z.number().int().min(0),
  analyzedFiles: z.number().int().min(0),
  translatedFiles: z.number().int().min(0),
  failedFiles: z.number().int().min(0),
  pendingFiles: z.number().int().min(0),
});

export type TranslationProjectSummary = z.infer<
  typeof TranslationProjectSummarySchema
>;
