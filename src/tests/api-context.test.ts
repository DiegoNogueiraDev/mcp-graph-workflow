/**
 * Integration tests for GET /api/v1/context/preview route.
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/context/preview", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should return 400 when nodeId query param is missing", async () => {
    const res = await request(ctx.app).get("/api/v1/context/preview");
    expect(res.status).toBe(400);
  });

  it("should return 404 when nodeId does not exist", async () => {
    const res = await request(ctx.app).get("/api/v1/context/preview?nodeId=nonexistent");
    expect(res.status).toBe(404);
  });

  it("should return context payload for valid task node", async () => {
    const node = makeNode({ title: "Build login page", description: "User authentication flow" });
    ctx.store.insertNode(node);

    const res = await request(ctx.app).get(`/api/v1/context/preview?nodeId=${node.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("task");
  });

  it("should include metrics in response", async () => {
    const node = makeNode({ title: "Implement API", description: "REST endpoints" });
    ctx.store.insertNode(node);

    const res = await request(ctx.app).get(`/api/v1/context/preview?nodeId=${node.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("metrics");
    expect(res.body.metrics).toHaveProperty("originalChars");
    expect(res.body.metrics).toHaveProperty("compactChars");
    expect(res.body.metrics).toHaveProperty("reductionPercent");
    expect(res.body.metrics).toHaveProperty("estimatedTokens");
  });

  it("should return context for node without edges", async () => {
    const node = makeNode({ title: "Standalone task" });
    ctx.store.insertNode(node);

    const res = await request(ctx.app).get(`/api/v1/context/preview?nodeId=${node.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("task");
  });
});
