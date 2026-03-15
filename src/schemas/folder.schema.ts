import { z } from "zod/v4";

export const OpenFolderBodySchema = z.object({
  path: z.string().min(1, "Path is required"),
});

export type OpenFolderBody = z.infer<typeof OpenFolderBodySchema>;
