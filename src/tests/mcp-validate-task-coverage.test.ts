import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerValidateTask } from "../mcp/tools/validate-task.js";

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

function createServer(): McpServer {
  return new McpServer(
    { name: "test", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handler(server: McpServer, name: string): (...args: any[]) => any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (server as any)._registeredTools[name].handler;
}

function parseResult(result: { content: { type: string; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe("MCP validate_task tool", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerValidateTask(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should validate a URL successfully", async () => {
    const result = await handler(server, "validate_task")({ url: "http://example.com" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.url).toBe("http://example.com");
    expect(parsed.wordCount).toBe(100);
    expect(parsed.title).toBe("Example");
    expect(parsed.timestamp).toBe("2025-01-01T00:00:00.000Z");
  });

  it("should include nodeId when provided", async () => {
    const result = await handler(server, "validate_task")({
      url: "http://example.com",
      nodeId: "node-1",
    });
    const parsed = parseResult(result);
    expect(parsed.nodeId).toBe("node-1");
  });

  it("should not include nodeId when not provided", async () => {
    const result = await handler(server, "validate_task")({ url: "http://example.com" });
    const parsed = parseResult(result);
    expect(parsed.nodeId).toBeUndefined();
  });

  it("should include comparison when compareUrl provided", async () => {
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

    const result = await handler(server, "validate_task")({
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

  it("should call indexCapture for primary result", async () => {
    const { indexCapture } = await import("../core/rag/capture-indexer.js");
    (indexCapture as ReturnType<typeof vi.fn>).mockClear();

    await handler(server, "validate_task")({ url: "http://example.com" });

    expect(indexCapture).toHaveBeenCalledTimes(1);
  });

  it("should call indexCapture twice when comparison is present", async () => {
    const { runValidation } = await import("../core/capture/validate-runner.js");
    const { indexCapture } = await import("../core/rag/capture-indexer.js");
    (indexCapture as ReturnType<typeof vi.fn>).mockClear();

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

    await handler(server, "validate_task")({
      url: "http://example.com",
      compareUrl: "http://compare.com",
    });

    expect(indexCapture).toHaveBeenCalledTimes(2);
  });
});
