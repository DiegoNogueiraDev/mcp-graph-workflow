import { z } from "zod/v4";

export const KnowledgeSourceTypeSchema = z.enum([
  "upload", "serena", "memory", "code_context", "docs", "web_capture", "prd", "design", "sprint_plan", "phase_summary", "skill", "journey",
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
});

export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeSchema>;
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
