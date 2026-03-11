import { z } from "zod/v4";

export const ConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  dbPath: z.string().default("workflow-graph"),
  basePath: z.string().optional(),
  integrations: z
    .object({
      gitnexusPort: z.number().int().min(1).max(65535).default(3737),
      gitnexusAutoStart: z.boolean().default(true),
    })
    .default({ gitnexusPort: 3737, gitnexusAutoStart: true }),
});

export type McpGraphConfig = z.infer<typeof ConfigSchema>;
