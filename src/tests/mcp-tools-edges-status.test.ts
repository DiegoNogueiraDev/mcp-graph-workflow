import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerEdge } from "../mcp/tools/edge.js";
import { registerUpdateStatus } from "../mcp/tools/update-status.js";
import { registerMetrics } from "../mcp/tools/metrics.js";
import { registerInit } from "../mcp/tools/init.js";
import { makeNode } from "./helpers/factories.js";

function createServer(): McpServer {
  return new McpServer(
    { name: "test", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
}

function handler(server: McpServer, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (server as any)._registeredTools[name].handler;
}

function parseResult(result: { content: { type: string; text: string }[] }): unknown {
  return JSON.parse(result.content[0].text);
}

describe("MCP Tools: Edge, UpdateStatus, Metrics, Init", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  // ── Edge Tool ──────────────────────────────────────────────────────────

  describe("registerEdge", () => {
    let server: McpServer;

    beforeEach(() => {
      server = createServer();
      registerEdge(server, store);
    });

    it("should add edge between two nodes (happy path)", async () => {
      const n1 = makeNode({ title: "Node A" });
      const n2 = makeNode({ title: "Node B" });
      store.insertNode(n1);
      store.insertNode(n2);

      const result = await handler(server, "edge")({
        action: "add",
        from: n1.id,
        to: n2.id,
        relationType: "depends_on",
      });

      const parsed = parseResult(result) as { ok: boolean; edge: { from: string; to: string } };
      expect(parsed.ok).toBe(true);
      expect(parsed.edge.from).toBe(n1.id);
      expect(parsed.edge.to).toBe(n2.id);
      expect(result.isError).toBeUndefined();
    });

    it("should return error when missing params for add", async () => {
      const result = await handler(server, "edge")({
        action: "add",
      });

      const parsed = parseResult(result) as { error: string };
      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("from, to, and relationType are required");
    });

    it("should return error for self-referencing edge", async () => {
      const n1 = makeNode();
      store.insertNode(n1);

      const result = await handler(server, "edge")({
        action: "add",
        from: n1.id,
        to: n1.id,
        relationType: "depends_on",
      });

      const parsed = parseResult(result) as { error: string };
      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("Self-referencing");
    });

    it("should return error when from node not found", async () => {
      const n2 = makeNode();
      store.insertNode(n2);

      const result = await handler(server, "edge")({
        action: "add",
        from: "nonexistent",
        to: n2.id,
        relationType: "depends_on",
      });

      const parsed = parseResult(result) as { error: string };
      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("nonexistent");
    });

    it("should return error when to node not found", async () => {
      const n1 = makeNode();
      store.insertNode(n1);

      const result = await handler(server, "edge")({
        action: "add",
        from: n1.id,
        to: "nonexistent",
        relationType: "depends_on",
      });

      const parsed = parseResult(result) as { error: string };
      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("nonexistent");
    });

    it("should delete edge (happy path)", async () => {
      const n1 = makeNode();
      const n2 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);

      const addResult = await handler(server, "edge")({
        action: "add",
        from: n1.id,
        to: n2.id,
        relationType: "depends_on",
      });
      const edgeId = (parseResult(addResult) as { edge: { id: string } }).edge.id;

      const result = await handler(server, "edge")({
        action: "delete",
        id: edgeId,
      });

      const parsed = parseResult(result) as { ok: boolean; deletedId: string };
      expect(parsed.ok).toBe(true);
      expect(parsed.deletedId).toBe(edgeId);
    });

    it("should return error when deleting without id", async () => {
      const result = await handler(server, "edge")({
        action: "delete",
      });

      const parsed = parseResult(result) as { error: string };
      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("id is required");
    });

    it("should return error when deleting non-existent edge", async () => {
      const result = await handler(server, "edge")({
        action: "delete",
        id: "edge-nonexistent",
      });

      const parsed = parseResult(result) as { error: string };
      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("Edge not found");
    });

    it("should list all edges", async () => {
      const n1 = makeNode();
      const n2 = makeNode();
      const n3 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      await handler(server, "edge")({ action: "add", from: n1.id, to: n2.id, relationType: "depends_on" });
      await handler(server, "edge")({ action: "add", from: n2.id, to: n3.id, relationType: "blocks" });

      const result = await handler(server, "edge")({ action: "list" });
      const parsed = parseResult(result) as { total: number; edges: unknown[] };
      expect(parsed.total).toBe(2);
      expect(parsed.edges).toHaveLength(2);
    });

    it("should list edges by nodeId direction=from", async () => {
      const n1 = makeNode();
      const n2 = makeNode();
      const n3 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      await handler(server, "edge")({ action: "add", from: n1.id, to: n2.id, relationType: "depends_on" });
      await handler(server, "edge")({ action: "add", from: n3.id, to: n1.id, relationType: "blocks" });

      const result = await handler(server, "edge")({
        action: "list",
        nodeId: n1.id,
        direction: "from",
      });

      const parsed = parseResult(result) as { total: number; edges: { from: string }[] };
      expect(parsed.total).toBe(1);
      expect(parsed.edges[0].from).toBe(n1.id);
    });

    it("should list edges by nodeId direction=to", async () => {
      const n1 = makeNode();
      const n2 = makeNode();
      const n3 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      await handler(server, "edge")({ action: "add", from: n1.id, to: n2.id, relationType: "depends_on" });
      await handler(server, "edge")({ action: "add", from: n3.id, to: n2.id, relationType: "blocks" });

      const result = await handler(server, "edge")({
        action: "list",
        nodeId: n2.id,
        direction: "to",
      });

      const parsed = parseResult(result) as { total: number; edges: { to: string }[] };
      expect(parsed.total).toBe(2);
      for (const e of parsed.edges) {
        expect(e.to).toBe(n2.id);
      }
    });

    it("should list edges by nodeId direction=both", async () => {
      const n1 = makeNode();
      const n2 = makeNode();
      const n3 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      await handler(server, "edge")({ action: "add", from: n1.id, to: n2.id, relationType: "depends_on" });
      await handler(server, "edge")({ action: "add", from: n3.id, to: n1.id, relationType: "blocks" });

      const result = await handler(server, "edge")({
        action: "list",
        nodeId: n1.id,
        direction: "both",
      });

      const parsed = parseResult(result) as { total: number; edges: unknown[] };
      expect(parsed.total).toBe(2);
    });

    it("should return error when listing by non-existent nodeId", async () => {
      const result = await handler(server, "edge")({
        action: "list",
        nodeId: "nonexistent",
      });

      const parsed = parseResult(result) as { error: string };
      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("nonexistent");
    });

    it("should list empty result when no edges exist", async () => {
      const result = await handler(server, "edge")({ action: "list" });
      const parsed = parseResult(result) as { total: number; edges: unknown[] };
      expect(parsed.total).toBe(0);
      expect(parsed.edges).toHaveLength(0);
    });

    it("should add edge with optional reason and weight", async () => {
      const n1 = makeNode();
      const n2 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);

      const result = await handler(server, "edge")({
        action: "add",
        from: n1.id,
        to: n2.id,
        relationType: "related_to",
        reason: "Shared module dependency",
        weight: 0.8,
      });

      const parsed = parseResult(result) as { ok: boolean; edge: { reason: string; weight: number; relationType: string } };
      expect(parsed.ok).toBe(true);
      expect(parsed.edge.reason).toBe("Shared module dependency");
      expect(parsed.edge.weight).toBe(0.8);
      expect(parsed.edge.relationType).toBe("related_to");
    });

    it("should filter listed edges by relationType", async () => {
      const n1 = makeNode();
      const n2 = makeNode();
      const n3 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      await handler(server, "edge")({ action: "add", from: n1.id, to: n2.id, relationType: "depends_on" });
      await handler(server, "edge")({ action: "add", from: n1.id, to: n3.id, relationType: "blocks" });

      const result = await handler(server, "edge")({
        action: "list",
        relationType: "blocks",
      });

      const parsed = parseResult(result) as { total: number; edges: { relationType: string }[] };
      expect(parsed.total).toBe(1);
      expect(parsed.edges[0].relationType).toBe("blocks");
    });
  });

  // ── UpdateStatus Tool ──────────────────────────────────────────────────

  describe("registerUpdateStatus", () => {
    let server: McpServer;

    beforeEach(() => {
      server = createServer();
      registerUpdateStatus(server, store);
    });

    it("should update single node status", async () => {
      const n = makeNode({ status: "backlog" });
      store.insertNode(n);

      const result = await handler(server, "update_status")({
        id: n.id,
        status: "in_progress",
      });

      const parsed = parseResult(result) as { ok: boolean; node: { status: string } };
      expect(parsed.ok).toBe(true);
      expect(parsed.node.status).toBe("in_progress");
    });

    it("should return error when node not found", async () => {
      const result = await handler(server, "update_status")({
        id: "nonexistent",
        status: "done",
      });

      const parsed = parseResult(result) as { error: string };
      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("nonexistent");
    });

    it("should bulk update multiple nodes", async () => {
      const n1 = makeNode({ status: "backlog" });
      const n2 = makeNode({ status: "backlog" });
      const n3 = makeNode({ status: "backlog" });
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      const result = await handler(server, "update_status")({
        id: [n1.id, n2.id, n3.id],
        status: "ready",
      });

      const parsed = parseResult(result) as { ok: boolean; updated: string[]; notFound: string[] };
      expect(parsed.ok).toBe(true);
      expect(parsed.updated).toHaveLength(3);
      expect(parsed.notFound).toHaveLength(0);
    });

    it("should report not found ids in bulk update", async () => {
      const n1 = makeNode({ status: "backlog" });
      store.insertNode(n1);

      const result = await handler(server, "update_status")({
        id: [n1.id, "missing-1", "missing-2"],
        status: "ready",
      });

      const parsed = parseResult(result) as { ok: boolean; updated: string[]; notFound: string[] };
      expect(parsed.ok).toBe(true);
      expect(parsed.updated).toHaveLength(1);
      expect(parsed.notFound).toContain("missing-1");
      expect(parsed.notFound).toContain("missing-2");
    });
  });

  // ── Metrics Tool ───────────────────────────────────────────────────────

  describe("registerMetrics", () => {
    let server: McpServer;

    beforeEach(() => {
      server = createServer();
      registerMetrics(server, store);
    });

    it("should return stats with no nodes", async () => {
      const result = await handler(server, "metrics")({ mode: "stats" });

      const parsed = parseResult(result) as { ok: boolean; mode: string; totalNodes: number; totalEdges: number };
      expect(parsed.ok).toBe(true);
      expect(parsed.mode).toBe("stats");
      expect(parsed.totalNodes).toBe(0);
      expect(parsed.totalEdges).toBe(0);
    });

    it("should return stats with nodes and context reduction", async () => {
      const n1 = makeNode({ type: "task", title: "Task A", status: "backlog" });
      const n2 = makeNode({ type: "task", title: "Task B", status: "in_progress" });
      store.insertNode(n1);
      store.insertNode(n2);

      const result = await handler(server, "metrics")({ mode: "stats" });

      const parsed = parseResult(result) as {
        ok: boolean;
        mode: string;
        totalNodes: number;
        contextReduction: { avgReductionPercent: number; sampleSize: number } | null;
      };
      expect(parsed.ok).toBe(true);
      expect(parsed.totalNodes).toBe(2);
      if (parsed.contextReduction) {
        expect(parsed.contextReduction.sampleSize).toBeGreaterThan(0);
        expect(typeof parsed.contextReduction.avgReductionPercent).toBe("number");
      }
    });

    it("should return stats with edges counted", async () => {
      const n1 = makeNode({ type: "milestone", title: "M1" });
      const n2 = makeNode({ type: "task", title: "T1" });
      store.insertNode(n1);
      store.insertNode(n2);

      const edgeServer = createServer();
      registerEdge(edgeServer, store);
      await handler(edgeServer, "edge")({
        action: "add",
        from: n1.id,
        to: n2.id,
        relationType: "depends_on",
      });

      const result = await handler(server, "metrics")({ mode: "stats" });
      const parsed = parseResult(result) as { ok: boolean; totalNodes: number; totalEdges: number; project: string };
      expect(parsed.totalEdges).toBe(1);
      expect(parsed.totalNodes).toBe(2);
      expect(parsed.project).toBe("Test");
    });

    it("should return velocity with no sprints", async () => {
      const result = await handler(server, "metrics")({ mode: "velocity" });

      const parsed = parseResult(result) as { ok: boolean; mode: string; sprints: unknown[] };
      expect(parsed.ok).toBe(true);
      expect(parsed.mode).toBe("velocity");
      expect(parsed.sprints).toEqual([]);
    });

    it("should return velocity with sprint filter", async () => {
      const result = await handler(server, "metrics")({
        mode: "velocity",
        sprint: "sprint-1",
      });

      const parsed = parseResult(result) as { ok: boolean; mode: string; sprints: unknown[] };
      expect(parsed.ok).toBe(true);
      expect(parsed.mode).toBe("velocity");
      expect(parsed.sprints).toEqual([]);
    });
  });

  // ── Init Tool ──────────────────────────────────────────────────────────

  describe("registerInit", () => {
    it("should init project with name", async () => {
      const freshStore = SqliteStore.open(":memory:");
      const server = createServer();
      registerInit(server, freshStore);

      const result = await handler(server, "init")({ projectName: "My Project" });

      const parsed = parseResult(result) as { ok: boolean; project: { name: string } };
      expect(parsed.ok).toBe(true);
      expect(parsed.project.name).toBe("My Project");

      freshStore.close();
    });

    it("should init project without name", async () => {
      const freshStore = SqliteStore.open(":memory:");
      const server = createServer();
      registerInit(server, freshStore);

      const result = await handler(server, "init")({});

      const parsed = parseResult(result) as { ok: boolean; project: { name: string; id: string } };
      expect(parsed.ok).toBe(true);
      expect(parsed.project.id).toBeDefined();

      freshStore.close();
    });
  });
});
