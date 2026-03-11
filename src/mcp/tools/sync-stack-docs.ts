import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { DocsCacheStore } from "../../core/docs/docs-cache-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { DocsSyncer } from "../../core/docs/docs-syncer.js";
import { createMcpContext7Fetcher } from "../../core/docs/mcp-context7-fetcher.js";
import { detectStack } from "../../core/docs/stack-detector.js";
import { indexCachedDocs } from "../../core/rag/docs-indexer.js";
import { logger } from "../../core/utils/logger.js";

export function registerSyncStackDocs(server: McpServer, store: SqliteStore): void {
  server.tool(
    "sync_stack_docs",
    "Auto-detect project stack and sync documentation for all libraries via Context7. Caches results locally and indexes into knowledge store.",
    {
      basePath: z
        .string()
        .optional()
        .describe("Project base path (default: cwd)"),
      libraries: z
        .array(z.string())
        .optional()
        .describe("Specific library names to sync (overrides auto-detection)"),
    },
    async ({ basePath, libraries }) => {
      logger.debug("tool:sync_stack_docs", { basePath });
      const projectPath = basePath ?? process.cwd();
      const docsCacheStore = new DocsCacheStore(store.getDb());
      const knowledgeStore = new KnowledgeStore(store.getDb());
      const fetcher = createMcpContext7Fetcher();
      const syncer = new DocsSyncer(docsCacheStore, fetcher);

      let libNames: string[] = [];

      if (libraries && libraries.length > 0) {
        libNames = libraries;
      } else {
        const stack = await detectStack(projectPath);
        if (stack) {
          // Take top-level runtime deps (skip dev deps for now)
          libNames = stack.libraries
            .filter((l) => !l.name.startsWith("@types/"))
            .slice(0, 20)
            .map((l) => l.name);
        }
      }

      if (libNames.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ok: false, message: "No libraries detected to sync" }),
          }],
        };
      }

      const results: Array<{ lib: string; status: string }> = [];

      for (const lib of libNames) {
        try {
          await syncer.syncLib(lib);
          results.push({ lib, status: "synced" });
        } catch (err) {
          results.push({
            lib,
            status: `error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      // Index synced docs into knowledge store
      const indexResult = indexCachedDocs(knowledgeStore, docsCacheStore);

      logger.info("tool:sync_stack_docs:ok", { librariesProcessed: results.length, knowledgeIndexed: indexResult.documentsIndexed });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            librariesProcessed: results.length,
            results,
            knowledgeIndexed: indexResult.documentsIndexed,
          }, null, 2),
        }],
      };
    },
  );
}
