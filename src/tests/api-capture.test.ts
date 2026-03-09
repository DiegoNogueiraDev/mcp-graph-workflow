import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("POST /api/v1/capture", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should return 400 when URL is missing", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/capture")
      .send({});

    expect(res.status).toBe(400);
  });

  it("should return 400 for invalid URL", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/capture")
      .send({ url: "not-a-url" });

    expect(res.status).toBe(400);
  });

  it("should accept valid capture request shape", async () => {
    // This test validates the request validation passes for a valid shape.
    // The actual capture may fail (no browser) but should not return 400.
    const res = await request(ctx.app)
      .post("/api/v1/capture")
      .send({ url: "https://example.com" });

    // Should NOT be 400 (validation error). It may be 500 if Playwright isn't available.
    expect(res.status).not.toBe(400);
  });

  it("should accept optional selector parameter", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/capture")
      .send({ url: "https://example.com", selector: "main" });

    expect(res.status).not.toBe(400);
  });
});
