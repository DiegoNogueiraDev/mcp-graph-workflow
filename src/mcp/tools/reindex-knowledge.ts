import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { DocsCacheStore } from "../../core/docs/docs-cache-store.js";
import { EmbeddingStore } from "../../core/rag/embedding-store.js";
import { indexSerenaMemories } from "../../core/rag/serena-indexer.js";
import { indexCachedDocs } from "../../core/rag/docs-indexer.js";
import { indexAllEmbeddings } from "../../core/rag/rag-pipeline.js";
import { logger } from "../../core/utils/logger.js";

export function registerReindexKnowledge(server: McpServer, store: SqliteStore): void {
  server.tool(
    "reindex_knowledge",
    "Reindex all knowledge sources (Serena memories, cached docs) into the unified knowledge store and rebuild embeddings.",
    {
      basePath: z
        .string()
        .optional()
        .describe("Project base path for finding Serena memories (default: cwd)"),
      sources: z
        .array(z.enum(["serena", "docs", "embeddings"]))
        .optional()
        .describe("Which sources to reindex (default: all)"),
    },
    async ({ basePath, sources }) => {
      logger.debug("tool:reindex_knowledge", {});
      const projectPath = basePath ?? process.cwd();
      const allSources = !sources || sources.length === 0;
      const knowledgeStore = new KnowledgeStore(store.getDb());

      const results: Record<string, unknown> = {};

      if (allSources || sources?.includes("serena")) {
        results.serena = await indexSerenaMemories(knowledgeStore, projectPath);
      }

      if (allSources || sources?.includes("docs")) {
        const docsCacheStore = new DocsCacheStore(store.getDb());
        results.docs = indexCachedDocs(knowledgeStore, docsCacheStore);
      }

      if (allSources || sources?.includes("embeddings")) {
        const embeddingStore = new EmbeddingStore(store);
        embeddingStore.clear();
        results.embeddings = await indexAllEmbeddings(store, embeddingStore);
      }

      results.totalKnowledge = knowledgeStore.count();

      logger.info("tool:reindex_knowledge:ok", { totalKnowledge: results.totalKnowledge });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}
