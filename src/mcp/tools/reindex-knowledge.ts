import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { DocsCacheStore } from "../../core/docs/docs-cache-store.js";
import { EmbeddingStore } from "../../core/rag/embedding-store.js";
import { indexMemories } from "../../core/rag/memory-indexer.js";
import { indexCachedDocs } from "../../core/rag/docs-indexer.js";
import { indexSkills } from "../../core/rag/skill-indexer.js";
import { indexJourneyMaps } from "../../core/rag/journey-indexer.js";
import { JourneyStore } from "../../core/journey/journey-store.js";
import { indexAllEmbeddings } from "../../core/rag/rag-pipeline.js";
import { decayStaleKnowledge } from "../../core/rag/knowledge-quality.js";
import { linkBySharedContext } from "../../core/rag/knowledge-linker.js";
import { runSynthesisCycle } from "../../core/rag/knowledge-synthesizer.js";
import { reindexAll as reindexEntities } from "../../core/rag/entity-indexer.js";
import { indexAllNodes } from "../../core/rag/node-indexer.js";
import { indexCodeAnalysis } from "../../core/rag/code-context-indexer.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";
import { invalidateRagCache } from "./rag-context.js";

export function registerReindexKnowledge(server: McpServer, store: SqliteStore): void {
  server.tool(
    "reindex_knowledge",
    "Reindex all knowledge sources (memories, cached docs) into the unified knowledge store and rebuild embeddings.",
    {
      basePath: z
        .string()
        .optional()
        .describe("Project base path for finding memories (default: cwd)"),
      sources: z
        .array(z.enum(["memory", "serena", "docs", "skills", "journey", "embeddings", "quality", "relations", "synthesis", "entities", "graph", "code"]))
        .optional()
        .describe("Which sources to reindex. 'quality' recalculates scores, 'relations' links docs, 'synthesis' generates insights. (default: all)"),
    },
    async ({ basePath, sources }) => {
      logger.debug("tool:reindex_knowledge", {});
      invalidateRagCache();
      const projectPath = basePath ?? process.cwd();
      const allSources = !sources || sources.length === 0;
      const knowledgeStore = new KnowledgeStore(store.getDb());

      const results: Record<string, unknown> = {};

      if (allSources || sources?.includes("memory") || sources?.includes("serena")) {
        results.memories = await indexMemories(knowledgeStore, projectPath);
      }

      if (allSources || sources?.includes("docs")) {
        const docsCacheStore = new DocsCacheStore(store.getDb());
        results.docs = indexCachedDocs(knowledgeStore, docsCacheStore);
      }

      if (allSources || sources?.includes("skills")) {
        results.skills = await indexSkills(knowledgeStore, projectPath);
      }

      if (allSources || sources?.includes("journey")) {
        const project = store.getProject();
        if (project) {
          const journeyStore = new JourneyStore(store.getDb(), project.id);
          results.journey = indexJourneyMaps(knowledgeStore, journeyStore);
        }
      }

      if (allSources || sources?.includes("embeddings")) {
        const embeddingStore = new EmbeddingStore(store);
        embeddingStore.clear();
        results.embeddings = await indexAllEmbeddings(store, embeddingStore);
      }

      if (allSources || sources?.includes("quality")) {
        results.quality = decayStaleKnowledge(store.getDb());
      }

      if (allSources || sources?.includes("relations")) {
        results.relations = linkBySharedContext(store.getDb());
      }

      if (sources?.includes("synthesis")) {
        results.synthesis = runSynthesisCycle(store.getDb());
      }

      if (allSources || sources?.includes("graph")) {
        try {
          results.graph = indexAllNodes(store.getDb());
        } catch (err) {
          logger.warn("node-indexer:reindex-failed", { error: String(err) });
          results.graph = { error: "Graph node reindex failed" };
        }
      }

      if (allSources || sources?.includes("code")) {
        try {
          const symbols = store.getDb()
            .prepare("SELECT name, kind, file_path as file, is_exported as exported FROM code_symbols LIMIT 500")
            .all() as Array<{ name: string; kind: string; file: string; exported: number }>;
          if (symbols.length > 0) {
            results.code = indexCodeAnalysis(
              new KnowledgeStore(store.getDb()),
              {
                symbols: symbols.map((s) => ({ name: s.name, kind: s.kind, file: s.file, exported: s.exported === 1 })),
                flows: [],
              },
            );
          } else {
            results.code = { documentsIndexed: 0, note: "No code symbols found. Run code indexer first." };
          }
        } catch (err) {
          logger.warn("code-indexer:reindex-failed", { error: String(err) });
          results.code = { error: "Code symbol reindex failed" };
        }
      }

      if (allSources || sources?.includes("entities")) {
        try {
          results.entities = reindexEntities(store.getDb());
        } catch (err) {
          logger.warn("entity-indexer:reindex-failed", { error: String(err) });
          results.entities = { error: "Entity reindex failed" };
        }
      }

      results.totalKnowledge = knowledgeStore.count();

      logger.info("tool:reindex_knowledge:ok", { totalKnowledge: results.totalKnowledge });
      return mcpText(results);
    },
  );
}
