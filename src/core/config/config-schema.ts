import { z } from "zod/v4";
import { LspConfigOverrideSchema } from "../lsp/lsp-types.js";

export const ContextModeSchema = z.enum(["lean", "full"]);
export type ContextMode = z.infer<typeof ContextModeSchema>;

export const ConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  dbPath: z.string().default("workflow-graph"),
  basePath: z.string().optional(),
  contextMode: ContextModeSchema.default("lean"),
  dashboard: z
    .object({
      autoOpen: z.boolean().default(true),
    })
    .default({ autoOpen: true }),
  integrations: z
    .object({
      codeGraphAutoIndex: z.boolean().default(false),
      codeGraphReindexIntervalSec: z.number().int().min(0).default(0),
      lspServers: z.array(LspConfigOverrideSchema).default([]),
    })
    .default({ codeGraphAutoIndex: false, codeGraphReindexIntervalSec: 0, lspServers: [] }),
});

export type McpGraphConfig = z.infer<typeof ConfigSchema>;
