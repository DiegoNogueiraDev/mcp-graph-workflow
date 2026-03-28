import { z } from "zod/v4";

export const NodeTypeSchema = z.enum([
  "epic", "task", "subtask", "requirement", "constraint",
  "milestone", "acceptance_criteria", "risk", "decision",
]);

export const NodeStatusSchema = z.enum([
  "backlog", "ready", "in_progress", "blocked", "done",
]);

export const XpSizeSchema = z.enum(["XS", "S", "M", "L", "XL"]);

export const PrioritySchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
]);

export const SourceRefSchema = z.object({
  file: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  status: NodeStatusSchema,
  priority: PrioritySchema,
  xpSize: XpSizeSchema.optional(),
  estimateMinutes: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional(),
  sprint: z.string().nullable().optional(),
  sourceRef: SourceRefSchema.optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  blocked: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
