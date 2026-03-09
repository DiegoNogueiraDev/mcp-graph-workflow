import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/nodes", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /nodes ──────────────────────────────

  describe("GET /api/v1/nodes", () => {
    it("should return empty array when no nodes exist", async () => {
      const res = await request(ctx.app).get("/api/v1/nodes");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("should return all nodes", async () => {
      ctx.store.insertNode(makeNode({ title: "Task A" }));
      ctx.store.insertNode(makeNode({ title: "Task B" }));

      const res = await request(ctx.app).get("/api/v1/nodes");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("should filter by type", async () => {
      ctx.store.insertNode(makeNode({ type: "task" }));
      ctx.store.insertNode(makeNode({ type: "epic" }));

      const res = await request(ctx.app).get("/api/v1/nodes?type=epic");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].type).toBe("epic");
    });

    it("should filter by status", async () => {
      ctx.store.insertNode(makeNode({ status: "backlog" }));
      ctx.store.insertNode(makeNode({ status: "done" }));

      const res = await request(ctx.app).get("/api/v1/nodes?status=done");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe("done");
    });

    it("should return 400 for invalid type filter", async () => {
      const res = await request(ctx.app).get("/api/v1/nodes?type=invalid");

      expect(res.status).toBe(400);
    });
  });

  // ── GET /nodes/:id ──────────────────────────

  describe("GET /api/v1/nodes/:id", () => {
    it("should return a node by id", async () => {
      const node = makeNode({ title: "Specific task" });
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get(`/api/v1/nodes/${node.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(node.id);
      expect(res.body.title).toBe("Specific task");
    });

    it("should return 404 for non-existent node", async () => {
      const res = await request(ctx.app).get("/api/v1/nodes/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  // ── POST /nodes ─────────────────────────────

  describe("POST /api/v1/nodes", () => {
    it("should create a node with minimal fields", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/nodes")
        .send({
          type: "task",
          title: "New task",
          status: "backlog",
          priority: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("New task");
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it("should create a node with custom id", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/nodes")
        .send({
          id: "custom_id",
          type: "epic",
          title: "Custom epic",
          status: "ready",
          priority: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("custom_id");
    });

    it("should return 400 for invalid body", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/nodes")
        .send({ title: "Missing type" });

      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /nodes/:id ────────────────────────

  describe("PATCH /api/v1/nodes/:id", () => {
    it("should update node fields", async () => {
      const node = makeNode();
      ctx.store.insertNode(node);

      const res = await request(ctx.app)
        .patch(`/api/v1/nodes/${node.id}`)
        .send({ title: "Updated title", priority: 1 });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Updated title");
      expect(res.body.priority).toBe(1);
    });

    it("should update node status", async () => {
      const node = makeNode({ status: "backlog" });
      ctx.store.insertNode(node);

      const res = await request(ctx.app)
        .patch(`/api/v1/nodes/${node.id}`)
        .send({ status: "in_progress" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("in_progress");
    });

    it("should return 404 for non-existent node", async () => {
      const res = await request(ctx.app)
        .patch("/api/v1/nodes/nonexistent")
        .send({ title: "Update" });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /nodes/:id ───────────────────────

  describe("DELETE /api/v1/nodes/:id", () => {
    it("should delete a node", async () => {
      const node = makeNode();
      ctx.store.insertNode(node);

      const res = await request(ctx.app).delete(`/api/v1/nodes/${node.id}`);

      expect(res.status).toBe(204);

      const check = await request(ctx.app).get(`/api/v1/nodes/${node.id}`);
      expect(check.status).toBe(404);
    });

    it("should return 404 for non-existent node", async () => {
      const res = await request(ctx.app).delete("/api/v1/nodes/nonexistent");

      expect(res.status).toBe(404);
    });
  });
});
