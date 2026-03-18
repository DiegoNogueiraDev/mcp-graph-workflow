/**
 * Tests for MCP CRUD tool handlers (add_node, update_node, delete_node, clone_node, move_node).
 * Registers each tool on McpServer and invokes the handler directly to verify
 * happy-path and error-path behavior end-to-end through the MCP layer.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAddNode } from "../mcp/tools/add-node.js";
import { registerUpdateNode } from "../mcp/tools/update-node.js";
import { registerDeleteNode } from "../mcp/tools/delete-node.js";
import { registerCloneNode } from "../mcp/tools/clone-node.js";
import { registerMoveNode } from "../mcp/tools/move-node.js";
import { makeNode, makeEpic } from "./helpers/factories.js";

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

describe("MCP CRUD Tool Handlers", () => {
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

  // ── add_node ──────────────────────────────────────────────

  describe("add_node", () => {
    beforeEach(() => {
      registerAddNode(server, store);
    });

    it("should create a node with minimal fields", async () => {
      const result = await tools(server)["add_node"].handler({ type: "task", title: "My Task" });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const node = parsed.node as Record<string, unknown>;
      expect(node.title).toBe("My Task");
      expect(node.type).toBe("task");
      expect(node.status).toBe("backlog");
      expect(node.priority).toBe(3);
      expect(typeof node.id).toBe("string");
    });

    it("should create a node with all optional fields", async () => {
      const result = await tools(server)["add_node"].handler({
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
      expect(node.tags).toEqual(["backend", "api"]);
    });

    it("should create a node under a parent and generate edges", async () => {
      const epic = makeEpic();
      store.insertNode(epic);

      const result = await tools(server)["add_node"].handler({
        type: "task",
        title: "Child Task",
        parentId: epic.id,
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const node = parsed.node as Record<string, unknown>;
      expect(node.parentId).toBe(epic.id);

      // Verify parent_of and child_of edges were created
      const edgesFrom = store.getEdgesFrom(epic.id);
      expect(edgesFrom.some((e) => e.to === node.id && e.relationType === "parent_of")).toBe(true);

      const edgesFromChild = store.getEdgesFrom(node.id as string);
      expect(edgesFromChild.some((e) => e.to === epic.id && e.relationType === "child_of")).toBe(true);
    });

    it("should return error when parent not found", async () => {
      const result = await tools(server)["add_node"].handler({
        type: "task",
        title: "Orphan",
        parentId: "nonexistent-id",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("Parent not found");
    });

    it("should create a node without parentId as root node", async () => {
      const result = await tools(server)["add_node"].handler({
        type: "epic",
        title: "Root Epic",
      });
      const parsed = parseResult(result);
      const node = parsed.node as Record<string, unknown>;

      expect(parsed.ok).toBe(true);
      expect(node.parentId).toBeUndefined();

      // No edges should be created for root nodes
      const edges = store.getEdgesFrom(node.id as string);
      expect(edges).toHaveLength(0);
    });

    it("should persist node in store after creation", async () => {
      const result = await tools(server)["add_node"].handler({
        type: "task",
        title: "Persistent",
      });
      const parsed = parseResult(result);
      const nodeId = (parsed.node as Record<string, unknown>).id as string;

      const stored = store.getNodeById(nodeId);
      expect(stored).not.toBeNull();
      expect(stored!.title).toBe("Persistent");
    });
  });

  // ── update_node ───────────────────────────────────────────

  describe("update_node", () => {
    beforeEach(() => {
      registerUpdateNode(server, store);
    });

    it("should update node title", async () => {
      const node = makeNode({ title: "Original" });
      store.insertNode(node);

      const result = await tools(server)["update_node"].handler({
        id: node.id,
        title: "Updated Title",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const updated = parsed.node as Record<string, unknown>;
      expect(updated.title).toBe("Updated Title");
    });

    it("should update multiple fields at once", async () => {
      const node = makeNode({ title: "Task", priority: 3 });
      store.insertNode(node);

      const result = await tools(server)["update_node"].handler({
        id: node.id,
        title: "Renamed",
        priority: 1,
        tags: ["urgent"],
        description: "New description",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const updated = parsed.node as Record<string, unknown>;
      expect(updated.title).toBe("Renamed");
      expect(updated.priority).toBe(1);
      expect(updated.tags).toEqual(["urgent"]);
      expect(updated.description).toBe("New description");
    });

    it("should return error when node not found", async () => {
      const result = await tools(server)["update_node"].handler({
        id: "nonexistent-id",
        title: "Does not matter",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toBeDefined();
      expect(typeof parsed.error).toBe("string");
    });

    it("should update sprint assignment", async () => {
      const node = makeNode({ title: "Task" });
      store.insertNode(node);

      const result = await tools(server)["update_node"].handler({
        id: node.id,
        sprint: "sprint-2",
      });
      const parsed = parseResult(result);
      const updated = parsed.node as Record<string, unknown>;

      expect(parsed.ok).toBe(true);
      expect(updated.sprint).toBe("sprint-2");
    });

    it("should clear sprint by setting null", async () => {
      const node = makeNode({ title: "Task", sprint: "sprint-1" });
      store.insertNode(node);

      const result = await tools(server)["update_node"].handler({
        id: node.id,
        sprint: null,
      });
      const parsed = parseResult(result);
      const updated = parsed.node as Record<string, unknown>;

      expect(parsed.ok).toBe(true);
      expect(updated.sprint == null).toBe(true);
    });
  });

  // ── delete_node ───────────────────────────────────────────

  describe("delete_node", () => {
    beforeEach(() => {
      registerDeleteNode(server, store);
    });

    it("should delete an existing node", async () => {
      const node = makeNode();
      store.insertNode(node);

      const result = await tools(server)["delete_node"].handler({ id: node.id });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.deletedId).toBe(node.id);

      // Verify node no longer exists
      expect(store.getNodeById(node.id)).toBeNull();
    });

    it("should return error when node not found", async () => {
      const result = await tools(server)["delete_node"].handler({ id: "nonexistent-id" });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toBeDefined();
    });

    it("should delete node and its associated edges", async () => {
      registerAddNode(server, store);

      const epic = makeEpic();
      store.insertNode(epic);

      // Create a child via add_node to get edges
      const addResult = await tools(server)["add_node"].handler({
        type: "task",
        title: "Child",
        parentId: epic.id,
      });
      const childId = (parseResult(addResult).node as Record<string, unknown>).id as string;

      // Delete the child
      const result = await tools(server)["delete_node"].handler({ id: childId });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);

      // Edges from epic should no longer reference child
      const edges = store.getEdgesFrom(epic.id);
      expect(edges.some((e) => e.to === childId)).toBe(false);
    });
  });

  // ── clone_node ────────────────────────────────────────────

  describe("clone_node", () => {
    beforeEach(() => {
      registerCloneNode(server, store);
    });

    it("should reset status to backlog on clone", async () => {
      const node = makeNode({ title: "Done Task", status: "done" });
      store.insertNode(node);

      const result = await tools(server)["clone_node"].handler({ id: node.id });
      const parsed = parseResult(result);
      const clone = parsed.node as Record<string, unknown>;

      expect(clone.status).toBe("backlog");
      expect(clone.blocked).toBe(false);
    });

    it("should shallow clone a node", async () => {
      const node = makeNode({ title: "Original", tags: ["a", "b"], priority: 2 });
      store.insertNode(node);

      const result = await tools(server)["clone_node"].handler({ id: node.id });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const clone = parsed.node as Record<string, unknown>;
      expect(clone.title).toBe("Original");
      expect(clone.tags).toEqual(["a", "b"]);
      expect(clone.priority).toBe(2);
      expect(clone.status).toBe("backlog");
      expect(clone.id).not.toBe(node.id);
    });

    it("should deep clone a node with children", async () => {
      const epic = makeEpic({ id: "epic-1" });
      store.insertNode(epic);

      const child1 = makeNode({ id: "child-1", title: "Child 1", parentId: "epic-1" });
      const child2 = makeNode({ id: "child-2", title: "Child 2", parentId: "epic-1" });
      store.insertNode(child1);
      store.insertNode(child2);

      // Register parent_of edges so getChildNodes works
      store.insertEdge({
        id: "edge-p1",
        from: "epic-1",
        to: "child-1",
        relationType: "parent_of",
        createdAt: epic.createdAt,
      });
      store.insertEdge({
        id: "edge-p2",
        from: "epic-1",
        to: "child-2",
        relationType: "parent_of",
        createdAt: epic.createdAt,
      });

      const result = await tools(server)["clone_node"].handler({ id: "epic-1", deep: true });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.clonedCount).toBe(3); // epic + 2 children
      const nodes = parsed.nodes as Record<string, unknown>[];
      expect(nodes).toHaveLength(3);
      // All cloned nodes should have new IDs
      const clonedIds = nodes.map((n) => n.id);
      expect(clonedIds).not.toContain("epic-1");
      expect(clonedIds).not.toContain("child-1");
      expect(clonedIds).not.toContain("child-2");
    });

    it("should clone to a specific parent", async () => {
      const parent = makeEpic({ id: "parent-1", title: "Parent" });
      store.insertNode(parent);

      const node = makeNode({ id: "node-1", title: "Source" });
      store.insertNode(node);

      const result = await tools(server)["clone_node"].handler({
        id: "node-1",
        newParentId: "parent-1",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const clone = parsed.node as Record<string, unknown>;
      expect(clone.parentId).toBe("parent-1");
    });

    it("should return error when source node not found", async () => {
      const result = await tools(server)["clone_node"].handler({ id: "nonexistent-id" });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toBeDefined();
    });

    it("should return error when new parent not found", async () => {
      const node = makeNode({ id: "node-1" });
      store.insertNode(node);

      const result = await tools(server)["clone_node"].handler({
        id: "node-1",
        newParentId: "nonexistent-parent",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("Parent not found");
    });
  });

  // ── move_node ─────────────────────────────────────────────

  describe("move_node", () => {
    beforeEach(() => {
      registerMoveNode(server, store);
    });

    it("should move a node to a new parent", async () => {
      const epicA = makeEpic({ id: "epic-a", title: "Epic A" });
      const epicB = makeEpic({ id: "epic-b", title: "Epic B" });
      const task = makeNode({ id: "task-1", title: "Task", parentId: "epic-a" });
      store.insertNode(epicA);
      store.insertNode(epicB);
      store.insertNode(task);

      // Create initial parent edges
      store.insertEdge({
        id: "edge-pa",
        from: "epic-a",
        to: "task-1",
        relationType: "parent_of",
        createdAt: epicA.createdAt,
      });
      store.insertEdge({
        id: "edge-ca",
        from: "task-1",
        to: "epic-a",
        relationType: "child_of",
        createdAt: epicA.createdAt,
      });

      const result = await tools(server)["move_node"].handler({
        id: "task-1",
        newParentId: "epic-b",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const moved = parsed.moved as Record<string, unknown>;
      expect(moved.from).toBe("epic-a");
      expect(moved.to).toBe("epic-b");

      // Verify node's parentId updated
      const updatedNode = parsed.node as Record<string, unknown>;
      expect(updatedNode.parentId).toBe("epic-b");

      // Verify old parent edges removed
      const oldEdges = store.getEdgesFrom("epic-a");
      expect(oldEdges.some((e) => e.to === "task-1" && e.relationType === "parent_of")).toBe(false);

      // Verify new parent edges created
      const newEdges = store.getEdgesFrom("epic-b");
      expect(newEdges.some((e) => e.to === "task-1" && e.relationType === "parent_of")).toBe(true);
    });

    it("should move a node to root (null parent)", async () => {
      const epic = makeEpic({ id: "epic-1", title: "Epic" });
      const task = makeNode({ id: "task-1", title: "Task", parentId: "epic-1" });
      store.insertNode(epic);
      store.insertNode(task);

      store.insertEdge({
        id: "edge-p",
        from: "epic-1",
        to: "task-1",
        relationType: "parent_of",
        createdAt: epic.createdAt,
      });
      store.insertEdge({
        id: "edge-c",
        from: "task-1",
        to: "epic-1",
        relationType: "child_of",
        createdAt: epic.createdAt,
      });

      const result = await tools(server)["move_node"].handler({
        id: "task-1",
        newParentId: null,
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const moved = parsed.moved as Record<string, unknown>;
      expect(moved.from).toBe("epic-1");
      expect(moved.to).toBeNull();

      // Verify old edges removed
      const edges = store.getEdgesFrom("epic-1");
      expect(edges.some((e) => e.to === "task-1")).toBe(false);
    });

    it("should return error when trying to set self as parent", async () => {
      const task = makeNode({ id: "task-1", title: "Task" });
      store.insertNode(task);

      const result = await tools(server)["move_node"].handler({
        id: "task-1",
        newParentId: "task-1",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("cannot be its own parent");
    });

    it("should return error on circular reference", async () => {
      // Create chain: epic -> task -> subtask, then try to move epic under subtask
      const epic = makeEpic({ id: "epic-1", title: "Epic" });
      const task = makeNode({ id: "task-1", title: "Task", parentId: "epic-1" });
      const subtask = makeNode({ id: "sub-1", title: "Subtask", parentId: "task-1" });
      store.insertNode(epic);
      store.insertNode(task);
      store.insertNode(subtask);

      const result = await tools(server)["move_node"].handler({
        id: "epic-1",
        newParentId: "sub-1",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("Circular reference");
    });

    it("should return error when node not found", async () => {
      const result = await tools(server)["move_node"].handler({
        id: "nonexistent-id",
        newParentId: null,
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toBeDefined();
    });

    it("should return error when new parent not found", async () => {
      const task = makeNode({ id: "task-1", title: "Task" });
      store.insertNode(task);

      const result = await tools(server)["move_node"].handler({
        id: "task-1",
        newParentId: "nonexistent-parent",
      });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("New parent not found");
    });

    it("should allow moving to a non-descendant node", async () => {
      // Two separate branches: epicA -> task, epicB (no relation)
      const epicA = makeEpic({ id: "epic-a", title: "A" });
      const epicB = makeEpic({ id: "epic-b", title: "B" });
      const task = makeNode({ id: "task-1", title: "Task", parentId: "epic-a" });
      store.insertNode(epicA);
      store.insertNode(epicB);
      store.insertNode(task);

      const result = await tools(server)["move_node"].handler({
        id: "task-1",
        newParentId: "epic-b",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(result.isError).toBeUndefined();
    });

    it("should move a root node to a parent", async () => {
      const epic = makeEpic({ id: "epic-1", title: "Epic" });
      const task = makeNode({ id: "task-1", title: "Root Task" }); // no parentId
      store.insertNode(epic);
      store.insertNode(task);

      const result = await tools(server)["move_node"].handler({
        id: "task-1",
        newParentId: "epic-1",
      });
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      const moved = parsed.moved as Record<string, unknown>;
      expect(moved.from).toBeNull();
      expect(moved.to).toBe("epic-1");

      // Verify new parent edges created
      const edges = store.getEdgesFrom("epic-1");
      expect(edges.some((e) => e.to === "task-1" && e.relationType === "parent_of")).toBe(true);
    });
  });
});
