/**
 * MCP Tools — Native Memory CRUD.
 * Provides write_memory, read_memory, list_memories, delete_memory.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import {
  listMemories,
  readMemory,
  writeMemory,
  deleteMemory,
} from "../../core/memory/memory-reader.js";
import { indexMemories } from "../../core/rag/memory-indexer.js";
import { indexEntitiesForSource } from "../../core/rag/entity-index-hook.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";

export function registerMemory(server: McpServer, store: SqliteStore): void {
  // ── write_memory ─────────────────────────────
  server.tool(
    "write_memory",
    "Write a project memory to workflow-graph/memories/{name}.md. Auto-indexes into the knowledge store for RAG search.",
    {
      name: z.string().min(1).regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_/.-]*$/).describe("Memory name (without .md extension). Supports nested paths like 'architecture/overview'. Only alphanumeric, hyphens, underscores, and forward slashes allowed."),
      content: z.string().min(1).describe("Memory content (markdown)."),
    },
    async ({ name, content }) => {
      logger.debug("tool:write_memory", { name });
      const basePath = process.cwd();

      const normalizedContent = normalizeNewlines(content) ?? content;
      await writeMemory(basePath, name, normalizedContent);

      // Auto-index into knowledge store
      const knowledgeStore = new KnowledgeStore(store.getDb());
      const indexResult = await indexMemories(knowledgeStore, basePath);
      indexEntitiesForSource(store.getDb(), "memory");

      return mcpText({
        ok: true,
        name,
        sizeBytes: Buffer.byteLength(normalizedContent, "utf-8"),
        indexed: indexResult.documentsIndexed,
      });
    },
  );

  // ── read_memory ──────────────────────────────
  server.tool(
    "read_memory",
    "Read a project memory from workflow-graph/memories/{name}.md.",
    {
      name: z.string().min(1).describe("Memory name (without .md extension)."),
    },
    async ({ name }) => {
      logger.debug("tool:read_memory", { name });
      const basePath = process.cwd();

      const memory = await readMemory(basePath, name);
      if (!memory) {
        return mcpError(`Memory not found: ${name}`);
      }

      return mcpText(memory);
    },
  );

  // ── list_memories ────────────────────────────
  server.tool(
    "list_memories",
    "List all project memories available in workflow-graph/memories/.",
    {},
    async () => {
      logger.debug("tool:list_memories", {});
      const basePath = process.cwd();

      const names = await listMemories(basePath);

      return mcpText({
        count: names.length,
        memories: names,
      });
    },
  );

  // ── delete_memory ────────────────────────────
  server.tool(
    "delete_memory",
    "Delete a project memory from workflow-graph/memories/{name}.md and remove from knowledge store.",
    {
      name: z.string().min(1).describe("Memory name to delete (without .md extension)."),
    },
    async ({ name }) => {
      logger.debug("tool:delete_memory", { name });
      const basePath = process.cwd();

      const deleted = await deleteMemory(basePath, name);
      if (!deleted) {
        return mcpError(`Memory not found: ${name}`);
      }

      // Remove from knowledge store
      const knowledgeStore = new KnowledgeStore(store.getDb());
      const docs = knowledgeStore.list({ sourceType: "memory" });
      let removed = 0;
      for (const doc of docs) {
        if (doc.sourceId === `memory:${name}`) {
          knowledgeStore.delete(doc.id);
          removed++;
        }
      }

      return mcpText({ ok: true, name, knowledgeDocsRemoved: removed });
    },
  );
}
