/**
 * Tests for the consolidated `validate` MCP tool (task + ac actions).
 * Covers happy paths, error paths, and logger coverage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerValidate } from "../mcp/tools/validate.js";
import { makeNode } from "./helpers/factories.js";
import { clearLogBuffer, getLogBuffer } from "../core/utils/logger.js";

// Mock validate-runner since it needs a real browser
vi.mock("../core/capture/validate-runner.js", () => ({
  runValidation: vi.fn().mockResolvedValue({
    primary: {
      url: "http://example.com",
      title: "Example",
      wordCount: 100,
      content: "Test content",
    },
    comparison: null,
    diff: null,
    timestamp: "2025-01-01T00:00:00.000Z",
  }),
}));

// Mock capture-indexer
vi.mock("../core/rag/capture-indexer.js", () => ({
  indexCapture: vi.fn(),
}));

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

describe("MCP validate tool (consolidated)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerValidate(server, store);
    clearLogBuffer();
  });

  afterEach(() => {
    store.close();
  });

  // ── action: "task" ──────────────────────────────────────

  describe('action: "task"', () => {
    it("should validate URL successfully", async () => {
      const result = await tools(server)["validate"].handler({ action: "task", url: "http://example.com" });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.url).toBe("http://example.com");
      expect(parsed.wordCount).toBe(100);
      expect(parsed.title).toBe("Example");
      expect(parsed.timestamp).toBe("2025-01-01T00:00:00.000Z");
    });

    it("should include nodeId when provided", async () => {
      const result = await tools(server)["validate"].handler({
        action: "task",
        url: "http://example.com",
        nodeId: "node-1",
      });
      const parsed = parseResult(result);

      expect(parsed.nodeId).toBe("node-1");
    });

    it("should return error when url missing", async () => {
      const result = await tools(server)["validate"].handler({ action: "task" });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("url is required");
    });

    it("should include comparison data when diff present", async () => {
      const { runValidation } = await import("../core/capture/validate-runner.js");
      (runValidation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        primary: {
          url: "http://example.com",
          title: "Example",
          wordCount: 100,
          content: "Test content",
        },
        comparison: {
          url: "http://compare.com",
          title: "Compare",
          wordCount: 120,
          content: "Compare content",
        },
        diff: {
          wordCountDelta: 20,
          lengthDelta: 30,
        },
        timestamp: "2025-01-01T00:00:00.000Z",
      });

      const result = await tools(server)["validate"].handler({
        action: "task",
        url: "http://example.com",
        compareUrl: "http://compare.com",
      });
      const parsed = parseResult(result);

      expect(parsed.comparison).toBeDefined();
      const comparison = parsed.comparison as Record<string, unknown>;
      expect(comparison.wordCountDelta).toBe(20);
      expect(comparison.lengthDelta).toBe(30);
      expect(comparison.compareUrl).toBe("http://compare.com");
    });
  });

  // ── action: "ac" ────────────────────────────────────────

  describe('action: "ac"', () => {
    it("should validate AC quality for all nodes", async () => {
      // Insert nodes with acceptance criteria
      const node1 = makeNode({
        title: "Task with AC",
        acceptanceCriteria: ["Given X when Y then Z", "User can see dashboard"],
      });
      const node2 = makeNode({
        title: "Another task",
        acceptanceCriteria: ["System responds within 2 seconds"],
      });
      store.insertNode(node1);
      store.insertNode(node2);

      const result = await tools(server)["validate"].handler({ action: "ac" });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.nodes).toBeDefined();
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(typeof parsed.overallScore).toBe("number");
    });

    it("should validate AC for specific nodeId", async () => {
      const node = makeNode({
        title: "Specific Task",
        acceptanceCriteria: ["Given X when Y then Z"],
      });
      store.insertNode(node);

      const result = await tools(server)["validate"].handler({ action: "ac", nodeId: node.id });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.nodes).toBeDefined();
    });
  });

  // ── Logger coverage ─────────────────────────────────────

  describe("logger coverage", () => {
    const origDebug = process.env.MCP_GRAPH_DEBUG;

    beforeEach(() => {
      process.env.MCP_GRAPH_DEBUG = "1";
    });

    afterEach(() => {
      if (origDebug === undefined) {
        delete process.env.MCP_GRAPH_DEBUG;
      } else {
        process.env.MCP_GRAPH_DEBUG = origDebug;
      }
    });

    it("should log debug on entry and info on success", async () => {
      // task action
      clearLogBuffer();
      await tools(server)["validate"].handler({ action: "task", url: "http://example.com" });
      let buffer = getLogBuffer();
      expect(buffer.some((e) => e.level === "debug" && e.message.includes("tool:validate"))).toBe(true);
      expect(buffer.some((e) => e.level === "info" && e.message.includes("tool:validate:task:ok"))).toBe(true);

      // ac action
      clearLogBuffer();
      await tools(server)["validate"].handler({ action: "ac" });
      buffer = getLogBuffer();
      expect(buffer.some((e) => e.level === "debug" && e.message.includes("tool:validate"))).toBe(true);
      expect(buffer.some((e) => e.level === "info" && e.message.includes("tool:validate:ac:ok"))).toBe(true);
    });
  });
});
