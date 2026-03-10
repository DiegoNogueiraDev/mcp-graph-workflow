/**
 * Integration tests for API graph document routes.
 * Tests GET /graph with real store, verifying node filtering
 * and the full pipeline from store → API → response.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode, makeEpic, makeTask, makeSubtask, makeEdge } from "./helpers/factories.js";

describe("API /api/v1/graph", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /graph ──────────────────────────────────

  describe("GET /api/v1/graph", () => {
    it("should return empty graph for fresh project", async () => {
      const res = await request(ctx.app).get("/api/v1/graph");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("nodes");
      expect(res.body).toHaveProperty("edges");
      expect(res.body.nodes).toEqual([]);
      expect(res.body.edges).toEqual([]);
    });

    it("should return all nodes and edges after insertion", async () => {
      const epic = makeEpic({ title: "Auth System" });
      const task = makeTask({ title: "Login Page", parentId: epic.id });
      const subtask = makeSubtask({ title: "Form validation", parentId: task.id });
      const edge = makeEdge(epic.id, task.id, { relationType: "parent_of" });

      ctx.store.insertNode(epic);
      ctx.store.insertNode(task);
      ctx.store.insertNode(subtask);
      ctx.store.insertEdge(edge);

      const res = await request(ctx.app).get("/api/v1/graph");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(3);
      expect(res.body.edges).toHaveLength(1);

      const nodeIds = res.body.nodes.map((n: { id: string }) => n.id);
      expect(nodeIds).toContain(epic.id);
      expect(nodeIds).toContain(task.id);
      expect(nodeIds).toContain(subtask.id);
    });

    it("should preserve node hierarchy via parentId", async () => {
      const epic = makeEpic({ title: "Epic" });
      const task = makeTask({ title: "Task", parentId: epic.id });

      ctx.store.insertNode(epic);
      ctx.store.insertNode(task);

      const res = await request(ctx.app).get("/api/v1/graph");

      const taskNode = res.body.nodes.find((n: { id: string }) => n.id === task.id);
      expect(taskNode.parentId).toBe(epic.id);
    });

    it("should include all node fields in response", async () => {
      const node = makeNode({
        title: "Test Node",
        type: "task",
        status: "in_progress",
        priority: 2,
      });
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get("/api/v1/graph");

      const returned = res.body.nodes[0];
      expect(returned.id).toBe(node.id);
      expect(returned.title).toBe("Test Node");
      expect(returned.type).toBe("task");
      expect(returned.status).toBe("in_progress");
      expect(returned.priority).toBe(2);
      expect(returned).toHaveProperty("createdAt");
      expect(returned).toHaveProperty("updatedAt");
    });
  });

  // ── GET /graph/mermaid ──────────────────────────

  describe("GET /api/v1/graph/mermaid", () => {
    it("should return mermaid syntax as text/plain", async () => {
      const epic = makeEpic({ title: "Auth" });
      ctx.store.insertNode(epic);

      const res = await request(ctx.app).get("/api/v1/graph/mermaid");

      expect(res.status).toBe(200);
      expect(res.type).toBe("text/plain");
      expect(res.text).toContain("graph");
    });

    it("should support direction query parameter", async () => {
      const node = makeNode({ title: "Test" });
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get("/api/v1/graph/mermaid?direction=LR");

      expect(res.status).toBe(200);
      expect(res.text).toContain("LR");
    });

    it("should return valid mermaid even for empty graph", async () => {
      const res = await request(ctx.app).get("/api/v1/graph/mermaid");

      expect(res.status).toBe(200);
      expect(res.text).toContain("graph");
    });
  });
});
