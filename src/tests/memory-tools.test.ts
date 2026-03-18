/**
 * Tests for MCP memory tool handlers (write_memory, read_memory, list_memories, delete_memory).
 * Tests the tool handler logic directly by calling the same core functions the handlers use,
 * verifying the full integration between tools layer and core memory-reader + knowledge store.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  writeMemory,
  readMemory,
  listMemories,
  deleteMemory,
} from "../core/memory/memory-reader.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexMemories } from "../core/rag/memory-indexer.js";

/**
 * Simulates the write_memory tool handler logic from src/mcp/tools/memory.ts.
 */
async function handleWriteMemory(
  basePath: string,
  store: SqliteStore,
  name: string,
  content: string,
): Promise<{ ok: boolean; name: string; sizeBytes: number; indexed: number }> {
  await writeMemory(basePath, name, content);

  const knowledgeStore = new KnowledgeStore(store.getDb());
  const indexResult = await indexMemories(knowledgeStore, basePath);

  return {
    ok: true,
    name,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    indexed: indexResult.documentsIndexed,
  };
}

/**
 * Simulates the read_memory tool handler logic.
 */
async function handleReadMemory(
  basePath: string,
  name: string,
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  const memory = await readMemory(basePath, name);
  if (!memory) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: `Memory not found: ${name}` }) }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(memory, null, 2) }],
  };
}

/**
 * Simulates the list_memories tool handler logic.
 */
async function handleListMemories(
  basePath: string,
): Promise<{ count: number; memories: string[] }> {
  const names = await listMemories(basePath);
  return { count: names.length, memories: names };
}

/**
 * Simulates the delete_memory tool handler logic.
 */
async function handleDeleteMemory(
  basePath: string,
  store: SqliteStore,
  name: string,
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  const deleted = await deleteMemory(basePath, name);
  if (!deleted) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: `Memory not found: ${name}` }) }],
      isError: true,
    };
  }

  const knowledgeStore = new KnowledgeStore(store.getDb());
  const docs = knowledgeStore.list({ sourceType: "memory" });
  let removed = 0;
  for (const doc of docs) {
    if (doc.sourceId === `memory:${name}`) {
      knowledgeStore.delete(doc.id);
      removed++;
    }
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: true, name, knowledgeDocsRemoved: removed }) }],
  };
}

describe("memory-tools", () => {
  let tmpBase: string;
  let store: SqliteStore;

  beforeEach(() => {
    tmpBase = path.join(tmpdir(), `memory-tools-test-${Date.now()}`);
    const memoriesDir = path.join(tmpBase, "workflow-graph", "memories");
    mkdirSync(memoriesDir, { recursive: true });
    store = SqliteStore.open(":memory:");
  });

  afterEach(() => {
    store.close();
    rmSync(tmpBase, { recursive: true, force: true });
  });

  // ── write_memory ─────────────────────────────────

  describe("write_memory", () => {
    it("should write a memory and return ok with size and index count", async () => {
      const result = await handleWriteMemory(store.getDb() ? tmpBase : tmpBase, store, "test-mem", "# Test\nHello world.");

      expect(result.ok).toBe(true);
      expect(result.name).toBe("test-mem");
      expect(result.sizeBytes).toBe(Buffer.byteLength("# Test\nHello world.", "utf-8"));
      expect(result.indexed).toBeGreaterThanOrEqual(1);
    });

    it("should index the written memory into knowledge store", async () => {
      await handleWriteMemory(tmpBase, store, "indexed-mem", "# Indexed Memory\nContent for search.");

      const knowledgeStore = new KnowledgeStore(store.getDb());
      const docs = knowledgeStore.list({ sourceType: "memory" });

      expect(docs.length).toBeGreaterThanOrEqual(1);
      const match = docs.find((d) => d.sourceId === "memory:indexed-mem");
      expect(match).toBeDefined();
      expect(match!.content).toContain("Indexed Memory");
    });

    it("should overwrite an existing memory on re-write", async () => {
      await handleWriteMemory(tmpBase, store, "overwrite-me", "# Version 1");
      await handleWriteMemory(tmpBase, store, "overwrite-me", "# Version 2");

      const memory = await readMemory(tmpBase, "overwrite-me");
      expect(memory).not.toBeNull();
      expect(memory!.content).toBe("# Version 2");
    });

    it("should support nested path names", async () => {
      const result = await handleWriteMemory(tmpBase, store, "arch/decisions/adr-001", "# ADR 001");

      expect(result.ok).toBe(true);
      expect(result.name).toBe("arch/decisions/adr-001");

      const memory = await readMemory(tmpBase, "arch/decisions/adr-001");
      expect(memory).not.toBeNull();
      expect(memory!.content).toBe("# ADR 001");
    });
  });

  // ── read_memory ──────────────────────────────────

  describe("read_memory", () => {
    it("should return memory content when it exists", async () => {
      await writeMemory(tmpBase, "readable", "# Readable\nSome content here.");

      const result = await handleReadMemory(tmpBase, "readable");

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.name).toBe("readable");
      expect(parsed.content).toContain("Readable");
      expect(parsed.sizeBytes).toBeGreaterThan(0);
    });

    it("should return isError when memory does not exist", async () => {
      const result = await handleReadMemory(tmpBase, "nonexistent");

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("Memory not found: nonexistent");
    });

    it("should return correct content type as text", async () => {
      await writeMemory(tmpBase, "type-check", "# Type Check");

      const result = await handleReadMemory(tmpBase, "type-check");
      expect(result.content[0].type).toBe("text");
    });
  });

  // ── list_memories ────────────────────────────────

  describe("list_memories", () => {
    it("should return empty list when no memories exist", async () => {
      const result = await handleListMemories(tmpBase);

      expect(result.count).toBe(0);
      expect(result.memories).toEqual([]);
    });

    it("should list all written memories", async () => {
      await writeMemory(tmpBase, "alpha", "# Alpha");
      await writeMemory(tmpBase, "beta", "# Beta");
      await writeMemory(tmpBase, "gamma", "# Gamma");

      const result = await handleListMemories(tmpBase);

      expect(result.count).toBe(3);
      expect(result.memories.sort()).toEqual(["alpha", "beta", "gamma"]);
    });

    it("should include nested memories in the listing", async () => {
      await writeMemory(tmpBase, "top-level", "# Top");
      await writeMemory(tmpBase, "sub/nested", "# Nested");

      const result = await handleListMemories(tmpBase);

      expect(result.count).toBe(2);
      expect(result.memories).toContain("top-level");
      expect(result.memories).toContain("sub/nested");
    });
  });

  // ── delete_memory ────────────────────────────────

  describe("delete_memory", () => {
    it("should delete an existing memory and return ok", async () => {
      await handleWriteMemory(tmpBase, store, "to-delete", "# Delete me");

      const result = await handleDeleteMemory(tmpBase, store, "to-delete");
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.ok).toBe(true);
      expect(parsed.name).toBe("to-delete");
      expect(result.isError).toBeUndefined();
    });

    it("should return isError when deleting non-existent memory", async () => {
      const result = await handleDeleteMemory(tmpBase, store, "ghost");

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("Memory not found: ghost");
    });

    it("should remove memory from knowledge store on delete", async () => {
      await handleWriteMemory(tmpBase, store, "indexed-delete", "# Will be deleted");

      // Verify it was indexed
      const knowledgeStore = new KnowledgeStore(store.getDb());
      const docsBefore = knowledgeStore.list({ sourceType: "memory" });
      const indexedBefore = docsBefore.filter((d) => d.sourceId === "memory:indexed-delete");
      expect(indexedBefore.length).toBeGreaterThanOrEqual(1);

      // Delete
      await handleDeleteMemory(tmpBase, store, "indexed-delete");

      // Verify removed from knowledge store
      const docsAfter = knowledgeStore.list({ sourceType: "memory" });
      const indexedAfter = docsAfter.filter((d) => d.sourceId === "memory:indexed-delete");
      expect(indexedAfter).toHaveLength(0);
    });

    it("should not affect other memories when deleting one", async () => {
      await handleWriteMemory(tmpBase, store, "keep-me", "# Keep");
      await handleWriteMemory(tmpBase, store, "delete-me", "# Delete");

      await handleDeleteMemory(tmpBase, store, "delete-me");

      const memory = await readMemory(tmpBase, "keep-me");
      expect(memory).not.toBeNull();
      expect(memory!.content).toBe("# Keep");

      const deleted = await readMemory(tmpBase, "delete-me");
      expect(deleted).toBeNull();
    });

    it("should report knowledgeDocsRemoved count", async () => {
      await handleWriteMemory(tmpBase, store, "count-docs", "# Count docs content");

      const result = await handleDeleteMemory(tmpBase, store, "count-docs");
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.knowledgeDocsRemoved).toBeGreaterThanOrEqual(1);
    });
  });
});
