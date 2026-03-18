import { z } from "zod/v4";
import { GraphNodeSchema } from "./node.schema.js";
import { GraphEdgeSchema } from "./edge.schema.js";

export const GraphIndexesSchema = z.object({
  byId: z.record(z.string(), z.number()),
  childrenByParent: z.record(z.string(), z.array(z.string())),
  incomingByNode: z.record(z.string(), z.array(z.string())),
  outgoingByNode: z.record(z.string(), z.array(z.string())),
});

export const GraphProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  fsPath: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GraphMetaSchema = z.object({
  sourceFiles: z.array(z.string()),
  lastImport: z.string().nullable(),
});

export const GraphDocumentSchema = z.object({
  version: z.string(),
  project: GraphProjectSchema,
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  indexes: GraphIndexesSchema,
  meta: GraphMetaSchema,
});
