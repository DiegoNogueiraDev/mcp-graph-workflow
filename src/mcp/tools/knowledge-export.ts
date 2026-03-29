/**
 * MCP Tool — export_knowledge
 * Export, import, or preview knowledge packages for collaboration.
 */

import { z } from "zod/v4";
import { readFileSync, writeFileSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { exportKnowledge, importKnowledge, previewImport } from "../../core/knowledge/knowledge-packager.js";
import { KnowledgePackageSchema } from "../../schemas/knowledge-package.schema.js";
import { assertPathInsideProject } from "../../core/utils/fs.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerKnowledgeExport(server: McpServer, store: SqliteStore): void {
  server.tool(
    "export_knowledge",
    "Export, import, or preview knowledge packages for collaboration. Enables sharing RAG knowledge between project instances.",
    {
      action: z.enum(["export", "import", "preview"]).describe("Action to perform"),
      filePath: z.string().optional().describe("Path for export output or import input (default: ./knowledge-export.json)"),
      sources: z.array(z.string()).optional().describe("Filter by source types (e.g. ['docs', 'memory'])"),
      minQuality: z.number().min(0).max(1).optional().describe("Minimum quality score filter (0-1, default: 0)"),
      includeMemories: z.boolean().optional().describe("Include project memories (default: true)"),
      includeTranslationMemory: z.boolean().optional().describe("Include translation memory entries (default: true)"),
    },
    async ({ action, filePath, sources, minQuality, includeMemories, includeTranslationMemory }) => {
      logger.debug("tool:export_knowledge", { action, filePath });

      const db = store.getDb();
      const basePath = process.cwd();
      const targetPath = filePath ?? "./knowledge-export.json";

      try {
        if (action === "export") {
          const result = await exportKnowledge(db, basePath, {
            sources,
            minQuality: minQuality ?? 0,
            includeMemories: includeMemories ?? true,
            includeTranslationMemory: includeTranslationMemory ?? true,
            includeRelations: true,
          });

          const absolutePath = assertPathInsideProject(targetPath);
          writeFileSync(absolutePath, JSON.stringify(result.package, null, 2), "utf-8");

          logger.info("tool:export_knowledge:export:ok", { path: absolutePath, ...result.stats });
          return mcpText({
            ok: true,
            action: "export",
            filePath: absolutePath,
            stats: result.stats,
          });
        }

        if (action === "import") {
          const absolutePath = assertPathInsideProject(targetPath);
          const raw = readFileSync(absolutePath, "utf-8");
          const json = JSON.parse(raw) as unknown;

          const parsed = KnowledgePackageSchema.safeParse(json);
          if (!parsed.success) {
            const errorMsg = parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ");
            return mcpError(`Invalid knowledge package: ${errorMsg}`);
          }

          const result = await importKnowledge(db, basePath, parsed.data);

          logger.info("tool:export_knowledge:import:ok", {
            documentsImported: result.documentsImported,
            documentsSkipped: result.documentsSkipped,
            memoriesImported: result.memoriesImported,
          });
          return mcpText({
            ok: true,
            action: "import",
            filePath: absolutePath,
            result,
          });
        }

        if (action === "preview") {
          const absolutePath = assertPathInsideProject(targetPath);
          const raw = readFileSync(absolutePath, "utf-8");
          const json = JSON.parse(raw) as unknown;

          const parsed = KnowledgePackageSchema.safeParse(json);
          if (!parsed.success) {
            const errorMsg = parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ");
            return mcpError(`Invalid knowledge package: ${errorMsg}`);
          }

          const preview = await previewImport(db, basePath, parsed.data);

          logger.info("tool:export_knowledge:preview:ok", {
            newDocuments: preview.newDocuments,
            existingDocuments: preview.existingDocuments,
          });
          return mcpText({
            ok: true,
            action: "preview",
            filePath: absolutePath,
            preview,
          });
        }

        return mcpError(`Unknown action: ${action}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn("tool:export_knowledge:fail", { action, error: message });
        return mcpError(message);
      }
    },
  );
}
