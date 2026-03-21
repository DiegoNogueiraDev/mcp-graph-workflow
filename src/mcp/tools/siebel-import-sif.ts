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
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";

export function registerSiebelImportSif(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel_import_sif",
    "Import a Siebel .SIF file. Parses XML, extracts objects and dependencies, optionally maps to graph nodes, and indexes into knowledge store for RAG retrieval.",
    {
      filePath: z.string().optional().describe("Path to the .sif file on disk"),
      content: z.string().optional().describe("Raw SIF XML content (alternative to filePath)"),
      fileName: z.string().optional().default("inline.sif").describe("File name for content mode"),
      mapToGraph: z.boolean().optional().default(true).describe("Convert Siebel objects to graph nodes and edges"),
    },
    async ({ filePath, content, fileName, mapToGraph }) => {
      logger.info("tool:siebel_import_sif", { filePath, fileName, mapToGraph });

      try {
        // Parse SIF
        let parseResult;
        if (filePath) {
          parseResult = await parseSifFile(filePath);
        } else if (content) {
          const normalizedContent = normalizeNewlines(content) ?? content;
          parseResult = parseSifContent(normalizedContent, fileName);
        } else {
          return mcpError("Either filePath or content is required");
        }

        const result: Record<string, unknown> = {
          ok: true,
          metadata: parseResult.metadata,
          objectCount: parseResult.objects.length,
          dependencyCount: parseResult.dependencies.length,
          objectTypes: parseResult.metadata.objectTypes,
        };

        // Map to graph nodes
        if (mapToGraph) {
          const { nodes, edges } = convertSifToGraph(parseResult);
          store.bulkInsert(nodes, edges);
          result.nodesCreated = nodes.length;
          result.edgesCreated = edges.length;
          result.epicId = nodes.find((n) => n.type === "epic")?.id;
        }

        // Index into knowledge store
        try {
          const knowledgeStore = new KnowledgeStore(store.getDb());
          const indexResult = indexSifContent(knowledgeStore, parseResult);
          result.documentsIndexed = indexResult.documentsIndexed;
        } catch (indexErr) {
          logger.warn("Siebel knowledge indexing failed (non-fatal)", {
            error: String(indexErr),
          });
        }

        // Record import
        store.recordImport(parseResult.metadata.fileName, parseResult.objects.length, parseResult.dependencies.length);

        return mcpText(result);
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
