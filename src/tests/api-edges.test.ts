import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import type { GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/edges", () => {
  let ctx: TestContext;
  let nodeA: GraphNode;
  let nodeB: GraphNode;

  beforeEach(() => {
    ctx = createTestApp();
    nodeA = makeNode({ title: "Node A" });
    nodeB = makeNode({ title: "Node B" });
    ctx.store.insertNode(nodeA);
    ctx.store.insertNode(nodeB);
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/edges", () => {
    it("should return empty array when no edges exist", async () => {
      const res = await request(ctx.app).get("/api/v1/edges");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("should return all edges", async () => {
      const edge: GraphEdge = {
        id: generateId("edge"),
        from: nodeA.id,
        to: nodeB.id,
        relationType: "depends_on",
        createdAt: now(),
      };
      ctx.store.insertEdge(edge);

      const res = await request(ctx.app).get("/api/v1/edges");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].from).toBe(nodeA.id);
      expect(res.body[0].to).toBe(nodeB.id);
    });
  });

  describe("POST /api/v1/edges", () => {
    it("should create an edge", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/edges")
        .send({
          from: nodeA.id,
          to: nodeB.id,
          relationType: "depends_on",
        });

      expect(res.status).toBe(201);
      expect(res.body.from).toBe(nodeA.id);
      expect(res.body.to).toBe(nodeB.id);
      expect(res.body.id).toBeDefined();
    });

    it("should return 400 for invalid relationType", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/edges")
        .send({
          from: nodeA.id,
          to: nodeB.id,
          relationType: "invalid_type",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/edges/:id", () => {
    it("should delete an edge", async () => {
      const edge: GraphEdge = {
        id: generateId("edge"),
        from: nodeA.id,
        to: nodeB.id,
        relationType: "depends_on",
        createdAt: now(),
      };
      ctx.store.insertEdge(edge);

      const res = await request(ctx.app).delete(`/api/v1/edges/${edge.id}`);
      expect(res.status).toBe(204);

      const check = await request(ctx.app).get("/api/v1/edges");
      expect(check.body).toHaveLength(0);
    });

    it("should return 404 for non-existent edge", async () => {
      const res = await request(ctx.app).delete("/api/v1/edges/nonexistent");
      expect(res.status).toBe(404);
    });
  });
});
