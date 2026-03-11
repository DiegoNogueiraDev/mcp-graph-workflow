import { z } from "zod/v4";

export const LogLevelSchema = z.enum(["info", "warn", "error", "success", "debug"]);

export const LogEntrySchema = z.object({
  id: z.number().int(),
  level: LogLevelSchema,
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
});

export type LogLevel = z.infer<typeof LogLevelSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
