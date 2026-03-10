/**
 * Integration tests for GET /api/v1/search route.
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/search", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should return 400 when q param is missing", async () => {
    const res = await request(ctx.app).get("/api/v1/search");
    expect(res.status).toBe(400);
  });

  it("should return 400 when q is empty string", async () => {
    const res = await request(ctx.app).get("/api/v1/search?q=");
    expect(res.status).toBe(400);
  });

  it("should return 400 when limit is invalid", async () => {
    const res = await request(ctx.app).get("/api/v1/search?q=test&limit=abc");
    expect(res.status).toBe(400);
  });

  it("should return empty array when no nodes match", async () => {
    const res = await request(ctx.app).get("/api/v1/search?q=nonexistent");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("should return matching nodes with score for valid query", async () => {
    const node = makeNode({ title: "Authentication module" });
    ctx.store.insertNode(node);

    const res = await request(ctx.app).get("/api/v1/search?q=Authentication");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("score");
  });

  it("should respect limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      ctx.store.insertNode(makeNode({ title: `Search feature ${i}` }));
    }

    const res = await request(ctx.app).get("/api/v1/search?q=Search&limit=2");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(2);
  });
});
