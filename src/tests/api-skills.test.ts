/**
 * Integration tests for GET /api/v1/skills route.
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/skills", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should return 200 status code", async () => {
    const res = await request(ctx.app).get("/api/v1/skills");
    expect(res.status).toBe(200);
  });

  it("should return array", async () => {
    const res = await request(ctx.app).get("/api/v1/skills");
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("should return skills with name field", async () => {
    const res = await request(ctx.app).get("/api/v1/skills");

    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty("name");
      expect(typeof res.body[0].name).toBe("string");
    }
  });
});
