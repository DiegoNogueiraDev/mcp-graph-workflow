/**
 * Tests for MCP Memory, RAG Context, Reindex Knowledge, Import PRD, and Sync Stack Docs tool handlers.
 * Registers each tool on McpServer and invokes the handler directly.
 * External filesystem/network dependencies are mocked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../core/memory/memory-reader.js", () => ({
  writeMemory: vi.fn().mockResolvedValue(undefined),
  readMemory: vi.fn(),
  listMemories: vi.fn().mockResolvedValue(["mem1", "mem2"]),
  deleteMemory: vi.fn(),
}));

vi.mock("../core/rag/memory-indexer.js", () => ({
  indexMemories: vi.fn().mockResolvedValue({ documentsIndexed: 1, skipped: 0 }),
}));

vi.mock("../core/rag/docs-indexer.js", () => ({
  indexCachedDocs: vi.fn().mockReturnValue({ documentsIndexed: 0, skipped: 0 }),
}));

vi.mock("../core/rag/skill-indexer.js", () => ({
  indexSkills: vi.fn().mockResolvedValue({ documentsIndexed: 0, skipped: 0 }),
}));

vi.mock("../core/rag/rag-pipeline.js", () => ({
  indexAllEmbeddings: vi.fn().mockResolvedValue({ indexed: 0 }),
}));

vi.mock("../core/parser/read-file.js", () => ({
  readPrdFile: vi.fn().mockResolvedValue({
    content: "# Test PRD\n## Feature\nAs a user I want...\n## Task\n- Do something",
    absolutePath: "/tmp/test.md",
    sizeBytes: 100,
  }),
}));

vi.mock("../core/docs/mcp-context7-fetcher.js", () => ({
  createMcpContext7Fetcher: vi.fn().mockReturnValue(() => Promise.resolve(null)),
}));

vi.mock("../core/docs/stack-detector.js", () => ({
  detectStack: vi.fn().mockResolvedValue(null),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTools = any;

function createServer(): McpServer {
  return new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
}

function tools(server: McpServer): AnyTools {
  return (server as AnyTools)._registeredTools;
}

function parseResult(result: { content: { type: string; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe("MCP Memory & RAG Tool Handlers", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    store.close();
  });

  // ── Memory Tools ──────────────────────────────────────────────────────────

  describe("write_memory", () => {
    beforeEach(async () => {
      const { registerMemory } = await import("../mcp/tools/memory.js");
      registerMemory(server, store);
    });

    it("should write a memory and return indexed count", async () => {
      const result = await tools(server)["write_memory"].handler({
        name: "architecture",
        content: "# Architecture\nSome notes",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.name).toBe("architecture");
      expect(parsed.sizeBytes).toBeGreaterThan(0);
      expect(parsed.indexed).toBe(1);
    });
  });

  describe("read_memory", () => {
    beforeEach(async () => {
      const { registerMemory } = await import("../mcp/tools/memory.js");
      registerMemory(server, store);
    });

    it("should return memory content when found", async () => {
      const { readMemory } = await import("../core/memory/memory-reader.js");
      vi.mocked(readMemory).mockResolvedValueOnce({ name: "test", content: "hello world" });

      const result = await tools(server)["read_memory"].handler({ name: "test" });
      const parsed = parseResult(result);

      expect(parsed.name).toBe("test");
      expect(parsed.content).toBe("hello world");
      expect(result.isError).toBeUndefined();
    });

    it("should return error when memory not found", async () => {
      const { readMemory } = await import("../core/memory/memory-reader.js");
      vi.mocked(readMemory).mockResolvedValueOnce(null);

      const result = await tools(server)["read_memory"].handler({ name: "nonexistent" });
      const parsed = parseResult(result);

      expect(parsed.error).toContain("Memory not found");
      expect(result.isError).toBe(true);
    });
  });

  describe("list_memories", () => {
    beforeEach(async () => {
      const { registerMemory } = await import("../mcp/tools/memory.js");
      registerMemory(server, store);
    });

    it("should return list of memory names", async () => {
      const result = await tools(server)["list_memories"].handler({});
      const parsed = parseResult(result);

      expect(parsed.count).toBe(2);
      expect(parsed.memories).toEqual(["mem1", "mem2"]);
    });
  });

  describe("delete_memory", () => {
    beforeEach(async () => {
      const { registerMemory } = await import("../mcp/tools/memory.js");
      registerMemory(server, store);
    });

    it("should delete memory and return success", async () => {
      const { deleteMemory } = await import("../core/memory/memory-reader.js");
      vi.mocked(deleteMemory).mockResolvedValueOnce(true);

      const result = await tools(server)["delete_memory"].handler({ name: "old-notes" });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.name).toBe("old-notes");
      expect(parsed.knowledgeDocsRemoved).toBeDefined();
    });

    it("should return error when memory not found for deletion", async () => {
      const { deleteMemory } = await import("../core/memory/memory-reader.js");
      vi.mocked(deleteMemory).mockResolvedValueOnce(false);

      const result = await tools(server)["delete_memory"].handler({ name: "ghost" });
      const parsed = parseResult(result);

      expect(parsed.error).toContain("Memory not found");
      expect(result.isError).toBe(true);
    });
  });

  // ── RAG Context Tool ─────────────────────────────────────────────────────

  describe("rag_context", () => {
    beforeEach(async () => {
      const { registerRagContext } = await import("../mcp/tools/rag-context.js");
      registerRagContext(server, store);

      // Add a node so there's something to search
      store.insertNode(makeNode({ title: "Auth module", description: "Login and signup flows" }));
    });

    it("should return context with default mode (no detail)", async () => {
      const result = await tools(server)["rag_context"].handler({
        query: "auth login",
      });
      const parsed = parseResult(result);

      expect(parsed).toBeDefined();
      // Default mode returns ragBuildContext output
      expect(result.isError).toBeUndefined();
    });

    it("should return context with detail=summary", async () => {
      const result = await tools(server)["rag_context"].handler({
        query: "auth",
        detail: "summary",
      });
      const parsed = parseResult(result);

      expect(parsed).toBeDefined();
      expect(result.isError).toBeUndefined();
    });

    it("should return context with detail=deep", async () => {
      const result = await tools(server)["rag_context"].handler({
        query: "auth",
        detail: "deep",
        tokenBudget: 2000,
      });
      const parsed = parseResult(result);

      expect(parsed).toBeDefined();
      expect(result.isError).toBeUndefined();
    });

    it("should work with empty graph", async () => {
      // Use a fresh store with no nodes
      const emptyStore = SqliteStore.open(":memory:");
      emptyStore.initProject("Empty");
      const emptyServer = createServer();

      const { registerRagContext } = await import("../mcp/tools/rag-context.js");
      registerRagContext(emptyServer, emptyStore);

      const result = await tools(emptyServer)["rag_context"].handler({
        query: "anything",
      });

      expect(result.isError).toBeUndefined();
      emptyStore.close();
    });
  });

  // ── Reindex Knowledge Tool ────────────────────────────────────────────────

  describe("reindex_knowledge", () => {
    beforeEach(async () => {
      const { registerReindexKnowledge } = await import("../mcp/tools/reindex-knowledge.js");
      registerReindexKnowledge(server, store);
    });

    it("should reindex all sources when no filter specified", async () => {
      const result = await tools(server)["reindex_knowledge"].handler({});
      const parsed = parseResult(result);

      expect(parsed.memories).toBeDefined();
      expect(parsed.docs).toBeDefined();
      expect(parsed.skills).toBeDefined();
      expect(parsed.embeddings).toBeDefined();
      expect(typeof parsed.totalKnowledge).toBe("number");
    });

    it("should reindex only memory source when specified", async () => {
      const result = await tools(server)["reindex_knowledge"].handler({
        sources: ["memory"],
      });
      const parsed = parseResult(result);

      expect(parsed.memories).toBeDefined();
      expect(parsed.docs).toBeUndefined();
      expect(parsed.skills).toBeUndefined();
      expect(parsed.embeddings).toBeUndefined();
      expect(typeof parsed.totalKnowledge).toBe("number");
    });

    it("should reindex only docs source when specified", async () => {
      const result = await tools(server)["reindex_knowledge"].handler({
        sources: ["docs"],
      });
      const parsed = parseResult(result);

      expect(parsed.docs).toBeDefined();
      expect(parsed.memories).toBeUndefined();
    });

    it("should accept serena alias for memory source", async () => {
      const result = await tools(server)["reindex_knowledge"].handler({
        sources: ["serena"],
      });
      const parsed = parseResult(result);

      // "serena" is an alias for "memory" — both trigger memories indexing
      expect(parsed.memories).toBeDefined();
      expect(parsed.docs).toBeUndefined();
    });
  });

  // ── Import PRD Tool ───────────────────────────────────────────────────────

  describe("import_prd", () => {
    beforeEach(async () => {
      const { registerImportPrd } = await import("../mcp/tools/import-prd.js");
      registerImportPrd(server, store);
    });

    it("should import a PRD file and create graph nodes", async () => {
      const result = await tools(server)["import_prd"].handler({
        filePath: "/tmp/test.md",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.sourceFile).toBe("test.md");
      expect(typeof parsed.nodesCreated).toBe("number");
      expect(typeof parsed.edgesCreated).toBe("number");
    });

    it("should reject re-import without force flag", async () => {
      // First import
      await tools(server)["import_prd"].handler({ filePath: "/tmp/test.md" });

      // Second import without force
      const result = await tools(server)["import_prd"].handler({
        filePath: "/tmp/test.md",
      });
      const parsed = parseResult(result);

      expect(parsed.error).toContain("already imported");
      expect(result.isError).toBe(true);
    });

    it("should allow re-import with force=true", async () => {
      // First import
      await tools(server)["import_prd"].handler({ filePath: "/tmp/test.md" });

      // Force re-import
      const result = await tools(server)["import_prd"].handler({
        filePath: "/tmp/test.md",
        force: true,
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.reimported).toBe(true);
      expect(typeof parsed.previousNodesDeleted).toBe("number");
    });
  });

  // ── Sync Stack Docs Tool ──────────────────────────────────────────────────

  describe("sync_stack_docs", () => {
    beforeEach(async () => {
      const { registerSyncStackDocs } = await import("../mcp/tools/sync-stack-docs.js");
      registerSyncStackDocs(server, store);
    });

    it("should return ok=false when no libraries detected", async () => {
      const result = await tools(server)["sync_stack_docs"].handler({});
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(false);
      expect(parsed.message).toContain("No libraries detected");
    });

    it("should process explicit libraries array", async () => {
      const result = await tools(server)["sync_stack_docs"].handler({
        libraries: ["express", "zod"],
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.librariesProcessed).toBe(2);
      expect(Array.isArray(parsed.results)).toBe(true);
    });

    it("should handle single library", async () => {
      const result = await tools(server)["sync_stack_docs"].handler({
        libraries: ["vitest"],
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.librariesProcessed).toBe(1);
    });
  });
});
