import { z } from "zod/v4";

export const RelationTypeSchema = z.enum([
  "parent_of", "child_of", "depends_on", "blocks",
  "related_to", "priority_over", "implements", "derived_from",
]);

export const GraphEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  relationType: RelationTypeSchema,
  weight: z.number().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
});
