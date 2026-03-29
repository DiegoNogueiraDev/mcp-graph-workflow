import { z } from "zod/v4";

export const KnowledgeDocumentExportSchema = z.object({
  sourceType: z.string(),
  sourceId: z.string(),
  title: z.string(),
  content: z.string(),
  contentHash: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  createdAt: z.string(),
});

export const KnowledgeRelationExportSchema = z.object({
  fromDocSourceId: z.string(),
  toDocSourceId: z.string(),
  relation: z.string(),
  score: z.number().min(0).max(1),
});

export const MemoryExportSchema = z.object({
  name: z.string(),
  content: z.string(),
});

export const TranslationMemoryExportSchema = z.object({
  constructId: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  confidenceBoost: z.number(),
  acceptanceCount: z.number(),
  correctionCount: z.number(),
});

export const KnowledgePackageManifestSchema = z.object({
  projectName: z.string(),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  documentCount: z.number(),
  memoryCount: z.number(),
  sourceTypes: z.array(z.string()),
  qualityThreshold: z.number().min(0).max(1),
  mcpGraphVersion: z.string().optional(),
});

export const KnowledgePackageSchema = z.object({
  version: z.literal("1.0"),
  manifest: KnowledgePackageManifestSchema,
  documents: z.array(KnowledgeDocumentExportSchema),
  relations: z.array(KnowledgeRelationExportSchema).optional(),
  memories: z.array(MemoryExportSchema).optional(),
  translationMemory: z.array(TranslationMemoryExportSchema).optional(),
});

export type KnowledgePackage = z.infer<typeof KnowledgePackageSchema>;
export type KnowledgeDocumentExport = z.infer<typeof KnowledgeDocumentExportSchema>;
export type KnowledgeRelationExport = z.infer<typeof KnowledgeRelationExportSchema>;
export type MemoryExport = z.infer<typeof MemoryExportSchema>;
export type TranslationMemoryExport = z.infer<typeof TranslationMemoryExportSchema>;
export type KnowledgePackageManifest = z.infer<typeof KnowledgePackageManifestSchema>;
