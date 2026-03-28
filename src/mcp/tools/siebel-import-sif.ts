/**
 * MCP Tool: siebel_import_sif
 * Imports a Siebel .SIF file, parses it, optionally maps to graph nodes, and indexes into knowledge store.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { parseSifFile, parseSifContent } from "../../core/siebel/sif-parser.js";
import { convertSifToGraph } from "../../core/siebel/sif-to-graph.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexSifContent } from "../../core/rag/siebel-indexer.js";
import { indexEntitiesForSource } from "../../core/rag/entity-index-hook.js";
import { batchImportSifs } from "../../core/siebel/sif-batch-importer.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";

function importSingleSif(
  store: SqliteStore,
  parseResult: import("../../schemas/siebel.schema.js").SiebelSifParseResult,
  mapToGraph: boolean,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ok: true,
    metadata: parseResult.metadata,
    objectCount: parseResult.objects.length,
    dependencyCount: parseResult.dependencies.length,
    objectTypes: parseResult.metadata.objectTypes,
  };

  if (mapToGraph) {
    const { nodes, edges } = convertSifToGraph(parseResult);
    store.bulkInsert(nodes, edges);
    result.nodesCreated = nodes.length;
    result.edgesCreated = edges.length;
    result.epicId = nodes.find((n) => n.type === "epic")?.id;
  }

  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    const indexResult = indexSifContent(knowledgeStore, parseResult);
    result.documentsIndexed = indexResult.documentsIndexed;
    indexEntitiesForSource(store.getDb(), "siebel_sif");
  } catch (indexErr) {
    logger.warn("Siebel knowledge indexing failed (non-fatal)", {
      error: String(indexErr),
    });
  }

  store.recordImport(parseResult.metadata.fileName, parseResult.objects.length, parseResult.dependencies.length);

  return result;
}

export function registerSiebelImportSif(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel_import_sif",
    "Import a Siebel .SIF file or batch-import all .SIF files from a directory. Parses XML, extracts objects and dependencies, optionally maps to graph nodes, and indexes into knowledge store for RAG retrieval.",
    {
      filePath: z.string().optional().describe("Path to a single .sif file on disk"),
      content: z.string().optional().describe("Raw SIF XML content (alternative to filePath)"),
      fileName: z.string().optional().default("inline.sif").describe("File name for content mode"),
      directory: z.string().optional().describe("Path to a directory containing .sif files for batch import"),
      concurrency: z.number().optional().default(5).describe("Max parallel imports for directory mode (default: 5)"),
      mapToGraph: z.boolean().optional().default(true).describe("Convert Siebel objects to graph nodes and edges"),
    },
    async ({ filePath, content, fileName, directory, concurrency, mapToGraph }) => {
      logger.info("tool:siebel_import_sif", { filePath, fileName, directory, concurrency, mapToGraph });

      try {
        // Batch import mode
        if (directory) {
          const batchResult = await batchImportSifs(directory, { concurrency });

          // Process each successful parse result through graph + knowledge pipeline
          let totalNodesCreated = 0;
          let totalEdgesCreated = 0;
          let totalDocsIndexed = 0;

          for (const parseResult of batchResult.results) {
            const singleResult = importSingleSif(store, parseResult, mapToGraph);
            totalNodesCreated += (singleResult.nodesCreated as number) ?? 0;
            totalEdgesCreated += (singleResult.edgesCreated as number) ?? 0;
            totalDocsIndexed += (singleResult.documentsIndexed as number) ?? 0;
          }

          return mcpText({
            ok: true,
            mode: "batch",
            totalFiles: batchResult.totalFiles,
            successCount: batchResult.successCount,
            errorCount: batchResult.errorCount,
            totalObjects: batchResult.totalObjects,
            totalDependencies: batchResult.totalDependencies,
            objectsByType: batchResult.objectsByType,
            nodesCreated: totalNodesCreated,
            edgesCreated: totalEdgesCreated,
            documentsIndexed: totalDocsIndexed,
            errors: batchResult.errors,
          });
        }

        // Single file mode
        let parseResult;
        if (filePath) {
          parseResult = await parseSifFile(filePath);
        } else if (content) {
          const normalizedContent = normalizeNewlines(content) ?? content;
          parseResult = parseSifContent(normalizedContent, fileName);
        } else {
          return mcpError("Either filePath, content, or directory is required");
        }

        return mcpText(importSingleSif(store, parseResult, mapToGraph));
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
