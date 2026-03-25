import { z } from "zod/v4";

export const KnowledgeSourceTypeSchema = z.enum([
  "upload", "serena", "memory", "code_context", "docs", "web_capture", "prd", "design", "sprint_plan", "phase_summary", "skill",
  "journey", "siebel_sif", "siebel_composer", "siebel_generated", "siebel_docs", "swagger",
  "ai_decision", "validation_result", "test_outcome", "synthesis",
  "benchmark", "graph_node",
]);

export const KnowledgeDocumentSchema = z.object({
  id: z.string(),
  sourceType: KnowledgeSourceTypeSchema,
  sourceId: z.string(),
  title: z.string(),
  content: z.string(),
  contentHash: z.string(),
  chunkIndex: z.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  qualityScore: z.number().min(0).max(1).optional(),
  usageCount: z.number().int().min(0).optional(),
  lastAccessedAt: z.string().optional(),
  stalenessDays: z.number().int().min(0).optional(),
});

export const KnowledgeRelationTypeSchema = z.enum([
  "related_to", "derived_from", "supersedes", "contradicts",
]);

export const KnowledgeRelationSchema = z.object({
  id: z.string(),
  fromDocId: z.string(),
  toDocId: z.string(),
  relation: KnowledgeRelationTypeSchema,
  score: z.number().min(0).max(1).default(1.0),
  createdAt: z.string(),
});

export const KnowledgeUsageActionSchema = z.enum([
  "retrieved", "helpful", "unhelpful", "outdated",
]);

export const KnowledgeUsageLogSchema = z.object({
  id: z.number().int(),
  docId: z.string(),
  query: z.string(),
  action: KnowledgeUsageActionSchema,
  context: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
});

export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeSchema>;
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
export type KnowledgeRelationType = z.infer<typeof KnowledgeRelationTypeSchema>;
export type KnowledgeRelation = z.infer<typeof KnowledgeRelationSchema>;
export type KnowledgeUsageAction = z.infer<typeof KnowledgeUsageActionSchema>;
export type KnowledgeUsageLog = z.infer<typeof KnowledgeUsageLogSchema>;
