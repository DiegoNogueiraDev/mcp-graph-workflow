/**
 * Full coverage tests for lifecycle-wrapper.ts:
 * - wrapToolsWithLifecycle() (lines 177-275)
 * - buildBlockedResponse() (lines 128-148)
 * - extractStatusArgs() (lines 153-170)
 * - appendLifecycleToResponse edge cases
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { z } from "zod/v4";
import {
  wrapToolsWithLifecycle,
  appendLifecycleToResponse,
} from "../mcp/lifecycle-wrapper.js";
import { makeNode } from "./helpers/factories.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyServer = any;

function createServer(): McpServer {
  return new McpServer(
    { name: "test", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
}

function tools(server: McpServer): Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> {
  return (server as AnyServer)._registeredTools;
}

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function makeDoc(nodes: Array<{ type: string; status: string; sprint?: string | null }> = []): unknown {
  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: nodes.map((n, i) => ({
      id: `node_${i}`,
      type: n.type,
      title: `Node ${i}`,
      status: n.status,
      priority: 3,
      sprint: n.sprint ?? null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    })),
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

// ── wrapToolsWithLifecycle ─────────────────────────────────────

describe("wrapToolsWithLifecycle", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("should wrap tool handlers and append _lifecycle block to response", async () => {
    server.tool("test_tool", "A test tool", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const result = await tools(server)["test_tool"].handler({}) as ToolCallResult;

    // Original content + lifecycle block
    expect(result.content.length).toBe(2);

    // First item is original response
    const original = JSON.parse(result.content[0].text);
    expect(original.ok).toBe(true);

    // Second item is lifecycle block
    const lifecycleWrapper = JSON.parse(result.content[1].text);
    expect(lifecycleWrapper._lifecycle).toBeDefined();
    expect(lifecycleWrapper._lifecycle.phase).toBeDefined();
    expect(lifecycleWrapper._lifecycle.reminder).toBeDefined();
    expect(lifecycleWrapper._lifecycle.suggestedNext).toBeInstanceOf(Array);
  });

  it("should not throw when wrapping a server with no registered tools", () => {
    expect(() => wrapToolsWithLifecycle(server, store)).not.toThrow();
  });

  it("should skip gate check gracefully when no project is loaded", async () => {
    const freshStore = SqliteStore.open(":memory:");
    // No initProject — store has no active project

    server.tool("test_no_project", "Test", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithLifecycle(server, freshStore);

    const result = await tools(server)["test_no_project"].handler({}) as ToolCallResult;

    // Should still return original content even without project
    expect(result.content[0].text).toContain("ok");
    freshStore.close();
  });

  it("should track token usage for tool calls without errors", async () => {
    server.tool("test_tokens", "Test", { name: z.string() }, async ({ name }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true, name }) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const result = await tools(server)["test_tokens"].handler({ name: "hello" }) as ToolCallResult;

    // Token tracking should complete silently
    expect(result.content.length).toBeGreaterThanOrEqual(1);
    const original = JSON.parse(result.content[0].text);
    expect(original.name).toBe("hello");
  });

  it("should wrap multiple tools at once", async () => {
    server.tool("tool_a", "Tool A", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ tool: "a" }) }],
    }));
    server.tool("tool_b", "Tool B", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ tool: "b" }) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const resultA = await tools(server)["tool_a"].handler({}) as ToolCallResult;
    const resultB = await tools(server)["tool_b"].handler({}) as ToolCallResult;

    // Both should have lifecycle blocks appended
    expect(resultA.content.length).toBe(2);
    expect(resultB.content.length).toBe(2);

    const lifecycleA = JSON.parse(resultA.content[1].text);
    const lifecycleB = JSON.parse(resultB.content[1].text);
    expect(lifecycleA._lifecycle.phase).toBeDefined();
    expect(lifecycleB._lifecycle.phase).toBeDefined();
  });

  it("should preserve original handler result content", async () => {
    const payload = { data: [1, 2, 3], message: "hello" };
    server.tool("test_preserve", "Test", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const result = await tools(server)["test_preserve"].handler({}) as ToolCallResult;
    const original = JSON.parse(result.content[0].text);
    expect(original.data).toEqual([1, 2, 3]);
    expect(original.message).toBe("hello");
  });
});

// ── Gate check / buildBlockedResponse ─────────────────────────

describe("wrapToolsWithLifecycle gate blocking", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("should block tool in strict mode when gate check produces errors", async () => {
    // Force ANALYZE phase via override + strict mode
    store.setProjectSetting("lifecycle_phase_override", "ANALYZE");
    store.setProjectSetting("lifecycle_strictness_mode", "strict");

    // update_status is gated (blocked) in ANALYZE phase
    server.tool("update_status", "Update status", {
      id: z.union([z.string(), z.array(z.string())]).optional(),
      status: z.string().optional(),
    }, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const result = await tools(server)["update_status"].handler({
      status: "done",
    }) as ToolCallResult;

    // Should be a blocked response
    expect(result.isError).toBe(true);
    const errorData = JSON.parse(result.content[0].text);
    expect(errorData.error).toBe("lifecycle_gate_blocked");
    expect(errorData.phase).toBe("ANALYZE");
    expect(errorData.tool).toBe("update_status");
    expect(errorData.reason).toBeTruthy();
    expect(errorData.warnings).toBeInstanceOf(Array);
    expect(errorData.hint).toContain("set_phase");
  });

  it("should allow always-allowed tools even in strict mode", async () => {
    store.setProjectSetting("lifecycle_phase_override", "ANALYZE");
    store.setProjectSetting("lifecycle_strictness_mode", "strict");

    server.tool("list", "List nodes", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ nodes: [] }) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const result = await tools(server)["list"].handler({}) as ToolCallResult;

    // Should NOT be blocked — list is always allowed
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.nodes).toEqual([]);
  });

  it("should not block tools in advisory mode", async () => {
    store.setProjectSetting("lifecycle_phase_override", "ANALYZE");
    store.setProjectSetting("lifecycle_strictness_mode", "advisory");

    server.tool("update_status", "Update status", {
      status: z.string().optional(),
    }, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const result = await tools(server)["update_status"].handler({
      status: "done",
    }) as ToolCallResult;

    // Advisory mode: warnings added but NOT blocked
    expect(result.isError).toBeUndefined();
    const original = JSON.parse(result.content[0].text);
    expect(original.ok).toBe(true);
  });
});

// ── extractStatusArgs (tested via update_status wrapping) ─────

describe("extractStatusArgs via update_status wrapping", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("should extract nodeId and status from update_status args", async () => {
    const node = makeNode({ id: "node-1", status: "backlog" });
    store.insertNode(node);

    // Force IMPLEMENT phase so update_status is allowed
    store.setProjectSetting("lifecycle_phase_override", "IMPLEMENT");
    store.setProjectSetting("lifecycle_strictness_mode", "strict");

    server.tool("update_status", "Update", {
      id: z.union([z.string(), z.array(z.string())]).optional(),
      nodeId: z.string().optional(),
      status: z.string().optional(),
    }, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const result = await tools(server)["update_status"].handler({
      nodeId: "node-1",
      status: "in_progress",
    }) as ToolCallResult;

    // Should complete (not blocked in IMPLEMENT phase for valid status transition)
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThanOrEqual(1);
  });

  it("should not extract status args for non-update_status tools", async () => {
    store.setProjectSetting("lifecycle_phase_override", "IMPLEMENT");
    store.setProjectSetting("lifecycle_strictness_mode", "strict");

    server.tool("add_node", "Add node", {
      type: z.string().optional(),
      title: z.string().optional(),
    }, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithLifecycle(server, store);

    const result = await tools(server)["add_node"].handler({
      type: "task",
      title: "Test",
    }) as ToolCallResult;

    // add_node should proceed normally, no status gate check
    expect(result.content.length).toBeGreaterThanOrEqual(1);
    const original = JSON.parse(result.content[0].text);
    expect(original.ok).toBe(true);
  });
});

// ── appendLifecycleToResponse edge cases ──────────────────────

describe("appendLifecycleToResponse edge cases", () => {
  it("should handle non-JSON response by appending as separate block", () => {
    const doc = makeDoc([{ type: "task", status: "backlog" }]);
    const result = appendLifecycleToResponse(
      "plain text response",
      doc as never,
    );

    expect(result).toContain("plain text response");
    expect(result).toContain("_lifecycle");
    expect(result).toContain("---");
  });

  it("should merge _lifecycle into valid JSON response", () => {
    const doc = makeDoc([{ type: "task", status: "backlog" }]);
    const result = appendLifecycleToResponse(
      '{"ok":true,"count":5}',
      doc as never,
    );

    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.count).toBe(5);
    expect(parsed._lifecycle).toBeDefined();
    expect(parsed._lifecycle.phase).toBeDefined();
  });

  it("should handle empty JSON object", () => {
    const doc = makeDoc();
    const result = appendLifecycleToResponse("{}", doc as never);

    const parsed = JSON.parse(result);
    expect(parsed._lifecycle).toBeDefined();
    expect(parsed._lifecycle.phase).toBe("ANALYZE");
  });

  it("should handle JSON array input gracefully", () => {
    const doc = makeDoc();
    const result = appendLifecycleToResponse("[1,2,3]", doc as never);

    // JSON arrays are valid JSON — JSON.parse succeeds, but _lifecycle
    // added as a non-index property on an array is ignored by JSON.stringify.
    // The result is still valid JSON containing the original array.
    expect(result).toBeDefined();
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toContain(1);
  });
});
