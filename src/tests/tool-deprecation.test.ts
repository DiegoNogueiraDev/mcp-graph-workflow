/**
 * Tests for backward compatibility of deprecated MCP tools.
 * Verifies that deprecated tools still work AND include _deprecated notice.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAddNode } from "../mcp/tools/add-node.js";
import { registerUpdateNode } from "../mcp/tools/update-node.js";
import { registerDeleteNode } from "../mcp/tools/delete-node.js";
import { registerValidateTask } from "../mcp/tools/validate-task.js";
import { registerValidateAc } from "../mcp/tools/validate-ac.js";
import { registerListSkills } from "../mcp/tools/list-skills.js";
import { registerNode } from "../mcp/tools/node.js";
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

describe("Deprecated tool backward compatibility", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    clearLogBuffer();
  });

  afterEach(() => {
    store.close();
  });

  // ── Deprecated node tools ───────────────────────────────

  describe("deprecated node tools", () => {
    it("add_node should still work and include _deprecated notice", async () => {
      registerAddNode(server, store);
      const result = await tools(server)["add_node"].handler({ type: "task", title: "Deprecated Add" });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed._deprecated).toBeDefined();
      expect(typeof parsed._deprecated).toBe("string");
      expect((parsed._deprecated as string)).toContain("node");
    });

    it("update_node should still work and include _deprecated notice", async () => {
      registerUpdateNode(server, store);
      const node = makeNode();
      store.insertNode(node);

      const result = await tools(server)["update_node"].handler({ id: node.id, title: "Updated" });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed._deprecated).toBeDefined();
      expect((parsed._deprecated as string)).toContain("node");
    });

    it("delete_node should still work and include _deprecated notice", async () => {
      registerDeleteNode(server, store);
      const node = makeNode();
      store.insertNode(node);

      const result = await tools(server)["delete_node"].handler({ id: node.id });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.deletedId).toBe(node.id);
      expect(parsed._deprecated).toBeDefined();
      expect((parsed._deprecated as string)).toContain("node");
    });
  });

  // ── Deprecated validate tools ───────────────────────────

  describe("deprecated validate tools", () => {
    it("validate_task should still work and include _deprecated notice", async () => {
      registerValidateTask(server, store);
      const result = await tools(server)["validate_task"].handler({ url: "http://example.com" });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed._deprecated).toBeDefined();
      expect((parsed._deprecated as string)).toContain("validate");
    });

    it("validate_ac should still work and include _deprecated notice", async () => {
      registerValidateAc(server, store);
      const result = await tools(server)["validate_ac"].handler({});
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed._deprecated).toBeDefined();
      expect((parsed._deprecated as string)).toContain("validate");
    });
  });

  // ── Deprecated list_skills ──────────────────────────────

  describe("deprecated list_skills", () => {
    it("list_skills should still work and include _deprecated notice", async () => {
      registerListSkills(server);
      const result = await tools(server)["list_skills"].handler({});
      const parsed = parseResult(result);

      expect(parsed.total).toBeGreaterThan(0);
      expect(parsed._deprecated).toBeDefined();
      expect((parsed._deprecated as string)).toContain("manage_skill");
    });
  });

  // ── Logger deprecation warnings ─────────────────────────

  describe("logger deprecation warnings", () => {
    it("deprecated tools should log warn with deprecation message", async () => {
      registerAddNode(server, store);
      clearLogBuffer();

      await tools(server)["add_node"].handler({ type: "task", title: "Warn Test" });

      const buffer = getLogBuffer();
      expect(buffer.some((e) => e.level === "warn" && e.message.includes("deprecated"))).toBe(true);
    });
  });

  // ── Result structure equivalence (old vs new) ───────────

  describe("result structure equivalence", () => {
    it('node(action:"add") result should match add_node result structure', async () => {
      registerAddNode(server, store);
      registerNode(server, store);

      const oldResult = await tools(server)["add_node"].handler({ type: "task", title: "Old Way" });
      const oldParsed = parseResult(oldResult);

      const newResult = await tools(server)["node"].handler({ action: "add", type: "task", title: "New Way" });
      const newParsed = parseResult(newResult);

      // Both should have same top-level keys (except _deprecated)
      expect(oldParsed.ok).toBe(true);
      expect(newParsed.ok).toBe(true);
      expect(oldParsed.node).toBeDefined();
      expect(newParsed.node).toBeDefined();

      const oldNode = oldParsed.node as Record<string, unknown>;
      const newNode = newParsed.node as Record<string, unknown>;
      expect(oldNode.type).toBe(newNode.type);
      expect(oldNode.status).toBe(newNode.status);
      expect(oldNode.priority).toBe(newNode.priority);

      // Old has _deprecated, new does not
      expect(oldParsed._deprecated).toBeDefined();
      expect(newParsed._deprecated).toBeUndefined();
    });

    it('validate(action:"ac") result should match validate_ac result structure', async () => {
      registerValidateAc(server, store);
      registerValidate(server, store);

      const oldResult = await tools(server)["validate_ac"].handler({});
      const oldParsed = parseResult(oldResult);

      const newResult = await tools(server)["validate"].handler({ action: "ac" });
      const newParsed = parseResult(newResult);

      // Both should have same structure
      expect(oldParsed.ok).toBe(true);
      expect(newParsed.ok).toBe(true);
      expect(oldParsed.nodes).toBeDefined();
      expect(newParsed.nodes).toBeDefined();
      expect(typeof oldParsed.overallScore).toBe("number");
      expect(typeof newParsed.overallScore).toBe("number");

      // Old has _deprecated, new does not
      expect(oldParsed._deprecated).toBeDefined();
      expect(newParsed._deprecated).toBeUndefined();
    });
  });
});
