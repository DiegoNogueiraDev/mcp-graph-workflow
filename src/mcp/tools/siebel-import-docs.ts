/**
 * MCP Tool: siebel_import_docs
 * Imports documentation (Swagger/WSDL, PDF, HTML, DOC/DOCX, Markdown)
 * and indexes into knowledge store for RAG context during SIF generation.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { parseSwaggerContent, parseWsdlContent } from "../../core/parser/read-swagger.js";
import { indexSwaggerContent } from "../../core/rag/swagger-indexer.js";
import { readFileContent } from "../../core/parser/file-reader.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { chunkText } from "../../core/rag/chunk-text.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";
import { readFile } from "node:fs/promises";

export function registerSiebelImportDocs(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel_import_docs",
    "Import documentation (Swagger/WSDL, PDF, HTML, DOC/DOCX, Markdown) into knowledge store for Siebel SIF generation context. Supports file path or inline content.",
    {
      filePath: z.string().optional().describe("Path to the documentation file on disk"),
      content: z.string().optional().describe("Raw documentation content (alternative to filePath)"),
      fileName: z.string().optional().default("inline-doc").describe("File name (used for source tracking)"),
      docType: z.enum(["swagger", "wsdl", "pdf", "html", "doc", "docx", "markdown"])
        .describe("Document type to determine parsing strategy"),
    },
    async ({ filePath, content, fileName, docType }) => {
      logger.info("tool:siebel_import_docs", { filePath, fileName, docType });

      try {
        const knowledgeStore = new KnowledgeStore(store.getDb());
        let documentsIndexed = 0;

        if (docType === "swagger" || docType === "wsdl") {
          // Swagger/WSDL: parse and index with specialized indexer
          const rawContent = content ?? (filePath ? await readFileToString(filePath) : undefined);
          if (!rawContent) {
            return mcpError("Either filePath or content is required");
          }
          const normalized = normalizeNewlines(rawContent) ?? rawContent;

          const parseResult = docType === "wsdl"
            ? parseWsdlContent(normalized)
            : parseSwaggerContent(normalized);

          const indexResult = indexSwaggerContent(knowledgeStore, parseResult, fileName);
          documentsIndexed = indexResult.documentsIndexed;

          return mcpText({
            ok: true,
            docType,
            fileName,
            title: parseResult.title,
            version: parseResult.version,
            format: parseResult.format,
            endpointsFound: parseResult.endpoints.length,
            schemasFound: parseResult.schemas.length,
            documentsIndexed,
          });
        }

        // General docs: PDF, HTML, DOC/DOCX, Markdown
        let textContent: string;
        if (filePath) {
          const fileResult = await readFileContent(filePath, fileName);
          textContent = fileResult.text;
        } else if (content) {
          textContent = normalizeNewlines(content) ?? content;
        } else {
          return mcpError("Either filePath or content is required");
        }

        // Chunk and index into knowledge store
        const sourceId = `siebel_docs:${fileName}`;
        knowledgeStore.deleteBySource("siebel_docs", sourceId);

        const chunks = chunkText(textContent);
        const chunkDocs = chunks.map((chunk, index) => ({
          sourceType: "siebel_docs" as const,
          sourceId,
          title: `Siebel Doc: ${fileName} [${index + 1}/${chunks.length}]`,
          content: chunk.content,
          chunkIndex: index,
          metadata: {
            docType,
            fileName,
            chunkTokens: chunk.tokens,
            indexedAt: new Date().toISOString(),
          },
        }));

        const docs = knowledgeStore.insertChunks(chunkDocs);
        documentsIndexed = docs.length;

        logger.info("Documentation indexed", {
          fileName,
          docType,
          chunks: String(chunks.length),
          documents: String(documentsIndexed),
        });

        return mcpText({
          ok: true,
          docType,
          fileName,
          textLength: textContent.length,
          chunksCreated: chunks.length,
          documentsIndexed,
        });
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}

async function readFileToString(filePath: string): Promise<string> {
  const buffer = await readFile(filePath, "utf-8");
  return buffer;
}
