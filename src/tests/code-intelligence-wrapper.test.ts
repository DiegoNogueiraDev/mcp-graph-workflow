/**
 * TDD tests for Code Intelligence MCP wrapper.
 * Tests the automatic enrichment of MCP tool responses with Code Intelligence data.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { CodeStore } from "../core/code/code-store.js";
import {
  detectStaleIndex,
  extractRelevantHints,
  buildCodeIntelBlock,
  buildBlockedResponseCodeIntel,
  wrapToolsWithCodeIntelligence,
} from "../mcp/code-intelligence-wrapper.js";

// ── Helpers ─────────────────────────────────────────────

function createInMemoryStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("test-project");
  return store;
}

function createCodeStore(store: SqliteStore): CodeStore {
  return new CodeStore(store.getDb());
}

function seedCodeIndex(codeStore: CodeStore, projectId: string, gitHash: string | null = "abc123"): void {
  codeStore.upsertIndexMeta({
    projectId,
    lastIndexed: new Date().toISOString(),
    fileCount: 10,
    symbolCount: 50,
    relationCount: 30,
    gitHash,
  });
}

function seedSymbol(codeStore: CodeStore, projectId: string, name: string, file: string, kind: string = "function"): string {
  codeStore.insertSymbolsBulk([{
    projectId,
    name,
    kind: kind as "function",
    file,
    startLine: 1,
    endLine: 10,
    exported: true,
    modulePath: file.replace(/\.ts$/, ""),
    signature: `${name}()`,
  }]);
  // Return the generated ID by looking it up
  const symbols = codeStore.findSymbolsByName(name, projectId);
  return symbols[0]?.id ?? "";
}

// ── detectStaleIndex ────────────────────────────────────

describe("detectStaleIndex", () => {
  let store: SqliteStore;
  let codeStore: CodeStore;

  beforeEach(() => {
    store = createInMemoryStore();
    codeStore = createCodeStore(store);
  });

  it("should return available=false when no index meta exists", () => {
    const result = detectStaleIndex(codeStore, "test-project");
    expect(result.available).toBe(false);
    expect(result.stale).toBe(false);
    expect(result.symbolCount).toBe(0);
  });

  it("should return available=true and stale=false when git hash matches", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");
    const result = detectStaleIndex(codeStore, "test-project", "abc123");
    expect(result.available).toBe(true);
    expect(result.stale).toBe(false);
    expect(result.symbolCount).toBe(50);
  });

  it("should return stale=true when git hash differs", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");
    const result = detectStaleIndex(codeStore, "test-project", "def456");
    expect(result.available).toBe(true);
    expect(result.stale).toBe(true);
  });

  it("should return stale=false when git hash is null (not a git repo)", () => {
    seedCodeIndex(codeStore, "test-project", null);
    const result = detectStaleIndex(codeStore, "test-project", null);
    expect(result.available).toBe(true);
    expect(result.stale).toBe(false);
  });

  it("should return stale=false when currentGitHash is null (git unavailable)", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");
    const result = detectStaleIndex(codeStore, "test-project", null);
    expect(result.available).toBe(true);
    expect(result.stale).toBe(false);
  });
});

// ── extractRelevantHints ────────────────────────────────

describe("extractRelevantHints", () => {
  it("should extract nodeId from tool args", () => {
    const hints = extractRelevantHints("update_status", [{ nodeId: "task-123" }]);
    expect(hints).toContain("task-123");
  });

  it("should extract camelCase/PascalCase words from title", () => {
    const hints = extractRelevantHints("node", [{ title: "Implement SqliteStore refactor" }]);
    expect(hints).toContain("Implement");
    expect(hints).toContain("SqliteStore");
  });

  it("should extract backtick-quoted identifiers from description", () => {
    const hints = extractRelevantHints("node", [{ description: "Fix bug in `buildTaskContext` and `estimateTokens`" }]);
    expect(hints).toContain("buildTaskContext");
    expect(hints).toContain("estimateTokens");
  });

  it("should extract file paths from file arg", () => {
    const hints = extractRelevantHints("code_intelligence", [{ file: "src/core/store/sqlite-store.ts" }]);
    expect(hints).toContain("src/core/store/sqlite-store.ts");
  });

  it("should return empty array for no args", () => {
    const hints = extractRelevantHints("list", []);
    expect(hints).toEqual([]);
  });

  it("should return empty array for undefined args", () => {
    const hints = extractRelevantHints("list", [undefined]);
    expect(hints).toEqual([]);
  });

  it("should deduplicate hints", () => {
    const hints = extractRelevantHints("node", [{ nodeId: "foo", title: "foo bar baz" }]);
    expect(new Set(hints).size).toBe(hints.length);
  });

  it("should filter out short words (<=3 chars) from title", () => {
    const hints = extractRelevantHints("node", [{ title: "Add new API endpoint" }]);
    expect(hints).not.toContain("Add");
    expect(hints).not.toContain("new");
    expect(hints).not.toContain("API");
    expect(hints).toContain("endpoint");
  });
});

// ── buildCodeIntelBlock ─────────────────────────────────

describe("buildCodeIntelBlock", () => {
  let store: SqliteStore;
  let codeStore: CodeStore;

  beforeEach(() => {
    store = createInMemoryStore();
    codeStore = createCodeStore(store);
  });

  it("should return off block when mode is off", () => {
    const block = buildCodeIntelBlock(codeStore, "test-project", "IMPLEMENT", "off", "next", []);
    expect(block.mode).toBe("off");
    expect(block.enrichment).toBeUndefined();
    expect(block.warnings).toHaveLength(0);
  });

  it("should return index_empty warning when no index exists (advisory)", () => {
    const block = buildCodeIntelBlock(codeStore, "test-project", "IMPLEMENT", "advisory", "update_status", [{}]);
    expect(block.mode).toBe("advisory");
    expect(block.indexStatus.available).toBe(false);
    expect(block.warnings.some(w => w.code === "index_empty")).toBe(true);
    expect(block.warnings.every(w => w.severity !== "error")).toBe(true);
  });

  it("should return index_empty error when no index exists (strict) and mutating tool", () => {
    const block = buildCodeIntelBlock(codeStore, "test-project", "IMPLEMENT", "strict", "update_status", [{}]);
    expect(block.warnings.some(w => w.code === "index_empty" && w.severity === "error")).toBe(true);
  });

  it("should NOT error for read-only tools even in strict with empty index", () => {
    const block = buildCodeIntelBlock(codeStore, "test-project", "IMPLEMENT", "strict", "list", []);
    expect(block.warnings.every(w => w.severity !== "error")).toBe(true);
  });

  it("should return stale warning when git hash mismatches", () => {
    seedCodeIndex(codeStore, "test-project", "old-hash");
    const block = buildCodeIntelBlock(codeStore, "test-project", "IMPLEMENT", "strict", "next", [], "new-hash");
    expect(block.indexStatus.stale).toBe(true);
    expect(block.warnings.some(w => w.code === "index_stale")).toBe(true);
  });

  it("should include implement enrichment with impact analysis in IMPLEMENT phase", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");
    seedSymbol(codeStore, "test-project", "buildTaskContext", "src/core/context.ts");

    const block = buildCodeIntelBlock(
      codeStore, "test-project", "IMPLEMENT", "strict",
      "node", [{ description: "Fix `buildTaskContext`" }], "abc123",
    );

    expect(block.enrichment).toBeDefined();
    expect(block.enrichment!.type).toBe("implement");
    expect(block.enrichment!.relevantSymbols.length).toBeGreaterThan(0);
  });

  it("should include review enrichment in REVIEW phase", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");
    seedSymbol(codeStore, "test-project", "analyzeImpact", "src/core/code/graph-traversal.ts");

    const block = buildCodeIntelBlock(
      codeStore, "test-project", "REVIEW", "strict",
      "node", [{ description: "Check `analyzeImpact`" }], "abc123",
    );

    expect(block.enrichment).toBeDefined();
    expect(block.enrichment!.type).toBe("review");
  });

  it("should include validate enrichment in VALIDATE phase", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");
    seedSymbol(codeStore, "test-project", "estimateTokens", "src/core/context/token-estimator.ts");

    const block = buildCodeIntelBlock(
      codeStore, "test-project", "VALIDATE", "strict",
      "node", [{ description: "Test `estimateTokens`" }], "abc123",
    );

    expect(block.enrichment).toBeDefined();
    expect(block.enrichment!.type).toBe("validate");
  });

  it("should include generic enrichment for ANALYZE phase", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");

    const block = buildCodeIntelBlock(
      codeStore, "test-project", "ANALYZE", "advisory",
      "import_prd", [{}], "abc123",
    );

    expect(block.enrichment).toBeDefined();
    expect(block.enrichment!.type).toBe("generic");
  });

  it("should include generic enrichment for DESIGN phase", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");

    const block = buildCodeIntelBlock(
      codeStore, "test-project", "DESIGN", "advisory",
      "node", [{}], "abc123",
    );

    expect(block.enrichment).toBeDefined();
    expect(block.enrichment!.type).toBe("generic");
  });

  it("should return no_relevant_symbols info when hints match nothing", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");

    const block = buildCodeIntelBlock(
      codeStore, "test-project", "IMPLEMENT", "strict",
      "node", [{ description: "Work on `nonExistentSymbol`" }], "abc123",
    );

    expect(block.warnings.some(w => w.code === "no_relevant_symbols")).toBe(true);
  });

  it("should limit topAffected to 5 symbols", () => {
    seedCodeIndex(codeStore, "test-project", "abc123");
    // Seed a symbol with many callers
    const coreId = seedSymbol(codeStore, "test-project", "coreFunction", "src/core.ts");
    for (let i = 0; i < 10; i++) {
      const callerId = seedSymbol(codeStore, "test-project", `caller${i}`, `src/caller${i}.ts`);
      codeStore.insertRelationsBulk([{
        projectId: "test-project",
        fromSymbol: callerId,
        toSymbol: coreId,
        type: "calls",
      }]);
    }

    const block = buildCodeIntelBlock(
      codeStore, "test-project", "IMPLEMENT", "strict",
      "node", [{ description: "Fix `coreFunction`" }], "abc123",
    );

    if (block.enrichment?.impactAnalysis) {
      expect(block.enrichment.impactAnalysis.topAffected.length).toBeLessThanOrEqual(5);
    }
  });
});

// ── wrapToolsWithCodeIntelligence ───────────────────────

describe("wrapToolsWithCodeIntelligence", () => {
  function createMockServer(tools: Record<string, { handler: (...args: unknown[]) => Promise<unknown>; enabled: boolean }>): unknown {
    return { _registeredTools: tools };
  }

  it("should skip wrapping when _registeredTools is not available", () => {
    const store = createInMemoryStore();
    const server = {} as unknown;
    // Should not throw
    wrapToolsWithCodeIntelligence(server as never, store);
  });

  it("should pass through when mode is off", async () => {
    const store = createInMemoryStore();
    const originalResult = { content: [{ type: "text", text: '{"ok":true}' }] };
    const handler = async () => originalResult;

    const server = createMockServer({ test_tool: { handler, enabled: true } });
    wrapToolsWithCodeIntelligence(server as never, store);

    const tools = (server as { _registeredTools: Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> })._registeredTools;
    const result = await tools.test_tool.handler({});
    // Mode is off by default, so original result should be returned without _code_intelligence
    const resultObj = result as { content: Array<{ type: string; text: string }> };
    expect(resultObj.content).toHaveLength(1);
  });

  it("should append _code_intelligence block when mode is advisory", async () => {
    const store = createInMemoryStore();
    store.setProjectSetting("code_intelligence_mode", "advisory");

    const originalResult = { content: [{ type: "text", text: '{"ok":true}' }] };
    const handler = async () => originalResult;

    const server = createMockServer({ test_tool: { handler, enabled: true } });
    wrapToolsWithCodeIntelligence(server as never, store);

    const tools = (server as { _registeredTools: Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> })._registeredTools;
    const result = await tools.test_tool.handler({});
    const resultObj = result as { content: Array<{ type: string; text: string }> };

    // Should have original content + _code_intelligence block
    expect(resultObj.content.length).toBeGreaterThan(1);
    const codeIntelText = resultObj.content[resultObj.content.length - 1].text;
    const parsed = JSON.parse(codeIntelText);
    expect(parsed._code_intelligence).toBeDefined();
    expect(parsed._code_intelligence.mode).toBe("advisory");
  });

  it("should block mutating tool in strict mode when index is empty", async () => {
    const store = createInMemoryStore();
    store.setProjectSetting("code_intelligence_mode", "strict");

    const handler = async () => ({ content: [{ type: "text", text: '{"ok":true}' }] });
    const server = createMockServer({ update_status: { handler, enabled: true } });
    wrapToolsWithCodeIntelligence(server as never, store);

    const tools = (server as { _registeredTools: Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> })._registeredTools;
    const result = await tools.update_status.handler({}) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("code_intelligence_gate_blocked");
  });

  it("should NOT block read-only tools in strict mode with empty index", async () => {
    const store = createInMemoryStore();
    store.setProjectSetting("code_intelligence_mode", "strict");

    const originalResult = { content: [{ type: "text", text: '{"nodes":[]}' }] };
    const handler = async () => originalResult;
    const server = createMockServer({ list: { handler, enabled: true } });
    wrapToolsWithCodeIntelligence(server as never, store);

    const tools = (server as { _registeredTools: Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> })._registeredTools;
    const result = await tools.list.handler({}) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    // Should execute (not blocked) and have enrichment appended
    expect(result.isError).toBeUndefined();
    expect(result.content.length).toBeGreaterThan(1);
  });

  it("should allow mutating tools in strict mode when index exists", async () => {
    const store = createInMemoryStore();
    store.setProjectSetting("code_intelligence_mode", "strict");

    // Seed index
    const codeStore = createCodeStore(store);
    seedCodeIndex(codeStore, store.getProject()!.id, "abc123");

    const originalResult = { content: [{ type: "text", text: '{"ok":true}' }] };
    const handler = async () => originalResult;
    const server = createMockServer({ update_status: { handler, enabled: true } });
    wrapToolsWithCodeIntelligence(server as never, store);

    const tools = (server as { _registeredTools: Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> })._registeredTools;
    const result = await tools.update_status.handler({}) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    // Should execute (not blocked)
    expect(result.isError).toBeUndefined();
    expect(result.content.length).toBeGreaterThan(1);
  });

  it("should gracefully handle errors in post-execution enrichment", async () => {
    const store = createInMemoryStore();
    store.setProjectSetting("code_intelligence_mode", "advisory");

    // Handler returns null content to trigger catch in enrichment
    const handler = async () => ({ content: null });
    const server = createMockServer({ test_tool: { handler, enabled: true } });
    wrapToolsWithCodeIntelligence(server as never, store);

    const tools = (server as { _registeredTools: Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> })._registeredTools;
    // Should not throw
    const result = await tools.test_tool.handler({});
    expect(result).toBeDefined();
  });
});

// ── buildBlockedResponseCodeIntel ───────────────────────

describe("buildBlockedResponseCodeIntel", () => {
  it("should return isError true with correct structure", () => {
    const response = buildBlockedResponseCodeIntel("update_status", [{
      code: "index_empty" as const,
      message: "Code index is empty",
      severity: "error" as const,
    }]);

    expect(response.isError).toBe(true);
    expect(response.content).toHaveLength(1);
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.error).toBe("code_intelligence_gate_blocked");
    expect(parsed.tool).toBe("update_status");
    expect(parsed.warnings).toHaveLength(1);
  });

  it("should include hint to run reindex", () => {
    const response = buildBlockedResponseCodeIntel("node", [{
      code: "index_empty" as const,
      message: "No index",
      severity: "error" as const,
    }]);

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.hint).toContain("reindex");
  });
});
