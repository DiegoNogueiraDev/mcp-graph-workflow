import { z } from "zod/v4";

export const ConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  dbPath: z.string().default("workflow-graph"),
  basePath: z.string().optional(),
  dashboard: z
    .object({
      autoOpen: z.boolean().default(true),
    })
    .default({ autoOpen: true }),
  integrations: z
    .object({
      codeGraphAutoIndex: z.boolean().default(false),
    })
    .default({ codeGraphAutoIndex: false }),
});

export type McpGraphConfig = z.infer<typeof ConfigSchema>;
