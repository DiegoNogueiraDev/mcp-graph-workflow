import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerList } from "../mcp/tools/list.js";
import { registerShow } from "../mcp/tools/show.js";
import { registerSearch } from "../mcp/tools/search.js";
import { registerContext } from "../mcp/tools/context.js";
import { registerNext } from "../mcp/tools/next.js";
import { registerExport } from "../mcp/tools/export.js";
import { registerSnapshot } from "../mcp/tools/snapshot.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function parse(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tools(server: McpServer): Record<string, { handler: (args: any) => Promise<ToolResult> }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (server as any)._registeredTools;
}

describe("MCP Tools — Query tools", () => {
  let server: McpServer;
  let store: SqliteStore;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  // ─── list ──────────────────────────────────────────────────────
  describe("list", () => {
    beforeEach(() => {
      registerList(server, store);
    });

    it("should return empty list when no nodes exist", async () => {
      const result = await tools(server)["list"].handler({});
      const data = parse(result);
      expect(data.total).toBe(0);
      expect(data.nodes).toEqual([]);
    });

    it("should return all nodes when no filters are applied", async () => {
      store.insertNode(makeNode({ id: "n1", title: "Task 1" }));
      store.insertNode(makeNode({ id: "n2", title: "Task 2" }));

      const result = await tools(server)["list"].handler({});
      const data = parse(result);
      expect(data.total).toBe(2);
      expect((data.nodes as Array<{ id: string }>).map((n) => n.id)).toContain("n1");
      expect((data.nodes as Array<{ id: string }>).map((n) => n.id)).toContain("n2");
    });

    it("should filter by type", async () => {
      store.insertNode(makeNode({ id: "t1", type: "task", title: "A task" }));
      store.insertNode(makeNode({ id: "e1", type: "epic", title: "An epic" }));

      const result = await tools(server)["list"].handler({ type: "epic" });
      const data = parse(result);
      expect(data.total).toBe(1);
      expect((data.nodes as Array<{ id: string }>)[0].id).toBe("e1");
    });

    it("should filter by status", async () => {
      store.insertNode(makeNode({ id: "t1", status: "backlog" }));
      store.insertNode(makeNode({ id: "t2", status: "done" }));

      const result = await tools(server)["list"].handler({ status: "done" });
      const data = parse(result);
      expect(data.total).toBe(1);
      expect((data.nodes as Array<{ id: string }>)[0].id).toBe("t2");
    });

    it("should filter by type AND status", async () => {
      store.insertNode(makeNode({ id: "t1", type: "task", status: "done" }));
      store.insertNode(makeNode({ id: "t2", type: "task", status: "backlog" }));
      store.insertNode(makeNode({ id: "e1", type: "epic", status: "done" }));

      const result = await tools(server)["list"].handler({ type: "task", status: "done" });
      const data = parse(result);
      expect(data.total).toBe(1);
      expect((data.nodes as Array<{ id: string }>)[0].id).toBe("t1");
    });

    it("should filter by sprint", async () => {
      store.insertNode(makeNode({ id: "t1", sprint: "sprint-1" }));
      store.insertNode(makeNode({ id: "t2", sprint: "sprint-2" }));
      store.insertNode(makeNode({ id: "t3" }));

      const result = await tools(server)["list"].handler({ sprint: "sprint-1" });
      const data = parse(result);
      expect(data.total).toBe(1);
      expect((data.nodes as Array<{ id: string }>)[0].id).toBe("t1");
    });

    it("should sort by priority ASC then createdAt ASC", async () => {
      store.insertNode(makeNode({ id: "low", priority: 5, createdAt: "2024-01-01T00:00:00Z" }));
      store.insertNode(makeNode({ id: "high", priority: 1, createdAt: "2024-01-02T00:00:00Z" }));
      store.insertNode(makeNode({ id: "high-earlier", priority: 1, createdAt: "2024-01-01T00:00:00Z" }));

      const result = await tools(server)["list"].handler({});
      const data = parse(result);
      const ids = (data.nodes as Array<{ id: string }>).map((n) => n.id);
      expect(ids).toEqual(["high-earlier", "high", "low"]);
    });
  });

  // ─── show ──────────────────────────────────────────────────────
  describe("show", () => {
    beforeEach(() => {
      registerShow(server, store);
    });

    it("should show node with edges and children", async () => {
      const parent = makeNode({ id: "parent", title: "Parent" });
      const child = makeNode({ id: "child", title: "Child", parentId: "parent" });
      const dep = makeNode({ id: "dep", title: "Dependency" });
      store.insertNode(parent);
      store.insertNode(child);
      store.insertNode(dep);
      store.insertEdge(makeEdge("parent", "dep"));

      const result = await tools(server)["show"].handler({ id: "parent" });
      expect(result.isError).toBeUndefined();
      const data = parse(result);
      expect((data.node as { id: string }).id).toBe("parent");
      expect((data.outgoingEdges as unknown[]).length).toBe(1);
      expect((data.children as Array<{ id: string }>)[0].id).toBe("child");
    });

    it("should return error when node not found", async () => {
      const result = await tools(server)["show"].handler({ id: "nonexistent" });
      expect(result.isError).toBe(true);
      const data = parse(result);
      expect(data.error).toBeDefined();
      expect(data.error).toContain("nonexistent");
    });
  });

  // ─── search ────────────────────────────────────────────────────
  describe("search", () => {
    beforeEach(() => {
      registerSearch(server, store);
    });

    it("should return matching results", async () => {
      store.insertNode(makeNode({ id: "t1", title: "Setup database migrations" }));
      store.insertNode(makeNode({ id: "t2", title: "Create user interface" }));

      const result = await tools(server)["search"].handler({ query: "database" });
      const data = parse(result);
      expect(data.query).toBe("database");
      expect((data.total as number)).toBeGreaterThanOrEqual(1);
      const ids = (data.results as Array<{ id: string }>).map((r) => r.id);
      expect(ids).toContain("t1");
    });

    it("should return empty when no match", async () => {
      store.insertNode(makeNode({ id: "t1", title: "Setup database" }));

      const result = await tools(server)["search"].handler({ query: "xyznonexistent" });
      const data = parse(result);
      expect(data.total).toBe(0);
      expect(data.results).toEqual([]);
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        store.insertNode(makeNode({ id: `t${i}`, title: `Authentication task ${i}` }));
      }

      const result = await tools(server)["search"].handler({ query: "authentication", limit: 2 });
      const data = parse(result);
      expect((data.results as unknown[]).length).toBeLessThanOrEqual(2);
    });

    it("should accept rerank parameter", async () => {
      store.insertNode(makeNode({ id: "t1", title: "Database migration setup", description: "Configure database schema migrations" }));
      store.insertNode(makeNode({ id: "t2", title: "API routes for database" }));

      const result = await tools(server)["search"].handler({ query: "database", rerank: true });
      const data = parse(result);
      expect((data.total as number)).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── context ───────────────────────────────────────────────────
  describe("context", () => {
    beforeEach(() => {
      registerContext(server, store);
    });

    it("should build context for existing node", async () => {
      store.insertNode(makeNode({ id: "ctx1", title: "Context task", description: "A task for context testing" }));

      const result = await tools(server)["context"].handler({ id: "ctx1" });
      expect(result.isError).toBeUndefined();
      const data = parse(result);
      expect(data).toBeDefined();
      expect((data.task as { id: string }).id).toBe("ctx1");
    });

    it("should return error when node not found", async () => {
      const result = await tools(server)["context"].handler({ id: "missing" });
      expect(result.isError).toBe(true);
      const data = parse(result);
      expect(data.error).toBeDefined();
    });
  });

  // ─── next ──────────────────────────────────────────────────────
  describe("next", () => {
    beforeEach(() => {
      registerNext(server, store);
    });

    it("should return next task when actionable tasks exist", async () => {
      store.insertNode(makeNode({ id: "n1", type: "task", status: "ready", priority: 1, title: "High priority task" }));
      store.insertNode(makeNode({ id: "n2", type: "task", status: "backlog", priority: 3, title: "Low priority task" }));

      const result = await tools(server)["next"].handler({});
      const data = parse(result);
      expect(data.node).toBeDefined();
      expect(data.reason).toBeDefined();
    });

    it("should return no-tasks message when all done or blocked", async () => {
      store.insertNode(makeNode({ id: "d1", status: "done", title: "Done task" }));

      const result = await tools(server)["next"].handler({});
      const data = parse(result);
      expect(data.message).toContain("No actionable tasks");
    });
  });

  // ─── export ────────────────────────────────────────────────────
  describe("export", () => {
    beforeEach(() => {
      registerExport(server, store);
    });

    it("should export as JSON", async () => {
      store.insertNode(makeNode({ id: "x1", title: "Export task" }));

      const result = await tools(server)["export"].handler({ action: "json" });
      const data = parse(result);
      expect(data.nodes).toBeDefined();
      expect(data.edges).toBeDefined();
      expect((data.nodes as unknown[]).length).toBe(1);
    });

    it("should export as mermaid diagram", async () => {
      store.insertNode(makeNode({ id: "m1", title: "Mermaid node" }));
      store.insertNode(makeNode({ id: "m2", title: "Second node" }));
      store.insertEdge(makeEdge("m1", "m2"));

      const result = await tools(server)["export"].handler({ action: "mermaid" });
      const text = result.content[0].text;
      // Mermaid output is plain text, not JSON
      expect(text).toContain("graph TD");
    });
  });

  // ─── snapshot ──────────────────────────────────────────────────
  describe("snapshot", () => {
    beforeEach(() => {
      registerSnapshot(server, store);
    });

    it("should create a snapshot", async () => {
      store.insertNode(makeNode({ id: "s1", title: "Snap task" }));

      const result = await tools(server)["snapshot"].handler({ action: "create" });
      const data = parse(result);
      expect(data.ok).toBe(true);
      expect(data.snapshotId).toBeDefined();
    });

    it("should list snapshots", async () => {
      store.insertNode(makeNode({ id: "s1", title: "Snap task" }));
      await tools(server)["snapshot"].handler({ action: "create" });

      const result = await tools(server)["snapshot"].handler({ action: "list" });
      const data = parse(result);
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect((data.snapshots as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    it("should restore a snapshot", async () => {
      store.insertNode(makeNode({ id: "s1", title: "Snap task" }));
      const createResult = await tools(server)["snapshot"].handler({ action: "create" });
      const snapId = parse(createResult).snapshotId as number;

      // Add another node after snapshot
      store.insertNode(makeNode({ id: "s2", title: "Post-snap task" }));
      expect(store.getAllNodes().length).toBe(2);

      // Restore should revert to 1 node
      const result = await tools(server)["snapshot"].handler({ action: "restore", snapshotId: snapId });
      const data = parse(result);
      expect(data.ok).toBe(true);
      expect(data.restoredFrom).toBe(snapId);
      expect(store.getAllNodes().length).toBe(1);
    });

    it("should return error when restoring without snapshotId", async () => {
      const result = await tools(server)["snapshot"].handler({ action: "restore" });
      expect(result.isError).toBe(true);
      const data = parse(result);
      expect(data.error).toContain("snapshotId");
    });
  });
});
