/**
 * Tests for the consolidated `node` MCP tool (add, update, delete actions).
 * Covers happy paths, error paths, parent-child edges, and logger coverage.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerNode } from "../mcp/tools/node.js";
import { makeNode, makeEpic } from "./helpers/factories.js";
import { clearLogBuffer, getLogBuffer } from "../core/utils/logger.js";

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

describe("MCP node tool (consolidated)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerNode(server, store);
    clearLogBuffer();
  });

  afterEach(() => {
    store.close();
  });

  // ── action: "add" ───────────────────────────────────────

  describe('action: "add"', () => {
    it("should create node with minimal fields (type + title)", async () => {
      const result = await tools(server)["node"].handler({ action: "add", type: "task", title: "My Task" });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const node = parsed.node as Record<string, unknown>;
      expect(node.title).toBe("My Task");
      expect(node.type).toBe("task");
      expect(node.status).toBe("backlog");
      expect(node.priority).toBe(3);
      expect(typeof node.id).toBe("string");
    });

    it("should create node with all optional fields", async () => {
      const result = await tools(server)["node"].handler({
        action: "add",
        type: "epic",
        title: "Full Epic",
        description: "Detailed description",
        status: "ready",
        priority: 1,
        xpSize: "L",
        estimateMinutes: 120,
        tags: ["backend", "api"],
        sprint: "sprint-1",
        acceptanceCriteria: ["AC1", "AC2"],
        blocked: false,
        metadata: { source: "test" },
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const node = parsed.node as Record<string, unknown>;
      expect(node.type).toBe("epic");
      expect(node.description).toBe("Detailed description");
      expect(node.status).toBe("ready");
      expect(node.priority).toBe(1);
      expect(node.xpSize).toBe("L");
      expect(node.estimateMinutes).toBe(120);
      expect(node.tags).toEqual(["backend", "api"]);
      expect(node.sprint).toBe("sprint-1");
      expect(node.acceptanceCriteria).toEqual(["AC1", "AC2"]);
    });

    it("should create parent-child edges when parentId provided", async () => {
      const epic = makeEpic();
      store.insertNode(epic);

      const result = await tools(server)["node"].handler({
        action: "add",
        type: "task",
        title: "Child Task",
        parentId: epic.id,
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const node = parsed.node as Record<string, unknown>;
      expect(node.parentId).toBe(epic.id);

      // Verify parent_of and child_of edges
      const edgesFrom = store.getEdgesFrom(epic.id);
      expect(edgesFrom.some((e) => e.to === node.id && e.relationType === "parent_of")).toBe(true);

      const edgesFromChild = store.getEdgesFrom(node.id as string);
      expect(edgesFromChild.some((e) => e.to === epic.id && e.relationType === "child_of")).toBe(true);
    });

    it("should return error when parent not found", async () => {
      const result = await tools(server)["node"].handler({
        action: "add",
        type: "task",
        title: "Orphan",
        parentId: "nonexistent-id",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("Parent not found");
    });

    it("should return error when type or title missing", async () => {
      const result = await tools(server)["node"].handler({ action: "add" });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("type and title are required");
    });
  });

  // ── action: "update" ────────────────────────────────────

  describe('action: "update"', () => {
    it("should update node fields partially", async () => {
      const node = makeNode({ title: "Original", priority: 3 });
      store.insertNode(node);

      const result = await tools(server)["node"].handler({
        action: "update",
        id: node.id,
        title: "Updated Title",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const updated = parsed.node as Record<string, unknown>;
      expect(updated.title).toBe("Updated Title");
      expect(updated.priority).toBe(3); // unchanged
    });

    it("should return error when node not found", async () => {
      const result = await tools(server)["node"].handler({
        action: "update",
        id: "nonexistent-id",
        title: "Irrelevant",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toBeDefined();
      expect(typeof parsed.error).toBe("string");
    });

    it("should return error when id missing", async () => {
      const result = await tools(server)["node"].handler({
        action: "update",
        title: "No id",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("id is required");
    });

    // ── Issue #5: Update parentId syncs edges ────────────

    it("should update edges when parentId changes", async () => {
      // Arrange — task under epicA, move to epicB
      const epicA = makeEpic({ title: "Epic A" });
      const epicB = makeEpic({ title: "Epic B" });
      store.insertNode(epicA);
      store.insertNode(epicB);

      const addResult = await tools(server)["node"].handler({
        action: "add",
        type: "task",
        title: "Child",
        parentId: epicA.id,
      });
      const childId = (parseResult(addResult).node as Record<string, unknown>).id as string;

      // Verify initial edges exist
      expect(store.getEdgesFrom(epicA.id).some((e) => e.to === childId && e.relationType === "parent_of")).toBe(true);
      expect(store.getEdgesFrom(childId).some((e) => e.to === epicA.id && e.relationType === "child_of")).toBe(true);

      // Act — update parentId to epicB
      await tools(server)["node"].handler({
        action: "update",
        id: childId,
        parentId: epicB.id,
      });

      // Assert — old edges removed, new edges created
      expect(store.getEdgesFrom(epicA.id).some((e) => e.to === childId && e.relationType === "parent_of")).toBe(false);
      expect(store.getEdgesFrom(childId).some((e) => e.to === epicA.id && e.relationType === "child_of")).toBe(false);

      expect(store.getEdgesFrom(epicB.id).some((e) => e.to === childId && e.relationType === "parent_of")).toBe(true);
      expect(store.getEdgesFrom(childId).some((e) => e.to === epicB.id && e.relationType === "child_of")).toBe(true);
    });

    it("should remove edges when parentId set to null", async () => {
      // Arrange
      const epic = makeEpic();
      store.insertNode(epic);

      const addResult = await tools(server)["node"].handler({
        action: "add",
        type: "task",
        title: "Child",
        parentId: epic.id,
      });
      const childId = (parseResult(addResult).node as Record<string, unknown>).id as string;

      // Act — update parentId to null (reparent to root)
      await tools(server)["node"].handler({
        action: "update",
        id: childId,
        parentId: null,
      });

      // Assert — old edges removed, no new edges
      expect(store.getEdgesFrom(epic.id).some((e) => e.to === childId && e.relationType === "parent_of")).toBe(false);
      expect(store.getEdgesFrom(childId).some((e) => e.to === epic.id && e.relationType === "child_of")).toBe(false);
    });

    it("should not touch edges when update does not include parentId", async () => {
      // Arrange
      const epic = makeEpic();
      store.insertNode(epic);

      const addResult = await tools(server)["node"].handler({
        action: "add",
        type: "task",
        title: "Child",
        parentId: epic.id,
      });
      const childId = (parseResult(addResult).node as Record<string, unknown>).id as string;

      // Act — update title only (no parentId field)
      await tools(server)["node"].handler({
        action: "update",
        id: childId,
        title: "New Title",
      });

      // Assert — edges still there
      expect(store.getEdgesFrom(epic.id).some((e) => e.to === childId && e.relationType === "parent_of")).toBe(true);
      expect(store.getEdgesFrom(childId).some((e) => e.to === epic.id && e.relationType === "child_of")).toBe(true);
    });
  });

  // ── action: "delete" ────────────────────────────────────

  describe('action: "delete"', () => {
    it("should delete existing node", async () => {
      const node = makeNode();
      store.insertNode(node);

      const result = await tools(server)["node"].handler({ action: "delete", id: node.id });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.deletedId).toBe(node.id);
      expect(store.getNodeById(node.id)).toBeNull();
    });

    it("should return error when node not found", async () => {
      const result = await tools(server)["node"].handler({ action: "delete", id: "nonexistent-id" });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toBeDefined();
    });

    it("should return error when id missing", async () => {
      const result = await tools(server)["node"].handler({ action: "delete" });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("id is required");
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

    it("should log debug on entry and info on success for each action", async () => {
      // add
      clearLogBuffer();
      await tools(server)["node"].handler({ action: "add", type: "task", title: "Log Test" });
      let buffer = getLogBuffer();
      expect(buffer.some((e) => e.level === "debug" && e.message.includes("tool:node"))).toBe(true);
      expect(buffer.some((e) => e.level === "info" && e.message.includes("tool:node:add:ok"))).toBe(true);

      // update — create a node first
      const node = makeNode();
      store.insertNode(node);
      clearLogBuffer();
      await tools(server)["node"].handler({ action: "update", id: node.id, title: "Updated" });
      buffer = getLogBuffer();
      expect(buffer.some((e) => e.level === "debug" && e.message.includes("tool:node"))).toBe(true);
      expect(buffer.some((e) => e.level === "info" && e.message.includes("tool:node:update:ok"))).toBe(true);

      // delete
      const node2 = makeNode();
      store.insertNode(node2);
      clearLogBuffer();
      await tools(server)["node"].handler({ action: "delete", id: node2.id });
      buffer = getLogBuffer();
      expect(buffer.some((e) => e.level === "debug" && e.message.includes("tool:node"))).toBe(true);
      expect(buffer.some((e) => e.level === "info" && e.message.includes("tool:node:delete:ok"))).toBe(true);
    });
  });
});
