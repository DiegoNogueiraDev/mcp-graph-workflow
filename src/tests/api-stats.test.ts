/**
 * Integration tests for GET /api/v1/stats route.
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode, makeEdge, makeEpic } from "./helpers/factories.js";

describe("API /api/v1/stats", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should return stats with zero counts for empty graph", async () => {
    const res = await request(ctx.app).get("/api/v1/stats");

    expect(res.status).toBe(200);
    expect(res.body.totalNodes).toBe(0);
    expect(res.body.totalEdges).toBe(0);
  });

  it("should return correct totalNodes and totalEdges after insertion", async () => {
    const n1 = makeNode();
    const n2 = makeNode();
    ctx.store.insertNode(n1);
    ctx.store.insertNode(n2);
    ctx.store.insertEdge(makeEdge(n1.id, n2.id));

    const res = await request(ctx.app).get("/api/v1/stats");

    expect(res.body.totalNodes).toBe(2);
    expect(res.body.totalEdges).toBe(1);
  });

  it("should return correct byType breakdown", async () => {
    ctx.store.insertNode(makeNode({ type: "task" }));
    ctx.store.insertNode(makeEpic());

    const res = await request(ctx.app).get("/api/v1/stats");

    expect(res.body.byType).toHaveProperty("task", 1);
    expect(res.body.byType).toHaveProperty("epic", 1);
  });

  it("should return correct byStatus breakdown", async () => {
    ctx.store.insertNode(makeNode({ status: "backlog" }));
    ctx.store.insertNode(makeNode({ status: "done" }));
    ctx.store.insertNode(makeNode({ status: "done" }));

    const res = await request(ctx.app).get("/api/v1/stats");

    expect(res.body.byStatus).toHaveProperty("backlog", 1);
    expect(res.body.byStatus).toHaveProperty("done", 2);
  });
});
