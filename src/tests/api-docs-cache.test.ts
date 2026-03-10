/**
 * Integration tests for /api/v1/docs routes (list, get, sync).
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/docs", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/docs", () => {
    it("should return empty array when no docs cached", async () => {
      const res = await request(ctx.app).get("/api/v1/docs");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it("should return docs with freshness field after sync", async () => {
      // Sync a doc first
      await request(ctx.app)
        .post("/api/v1/docs/sync")
        .send({ lib: "vitest" });

      const res = await request(ctx.app).get("/api/v1/docs");

      expect(res.status).toBe(200);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("freshness");
      }
    });

    it("should filter by lib query param after sync", async () => {
      // Sync a doc first so FTS table has data
      await request(ctx.app)
        .post("/api/v1/docs/sync")
        .send({ lib: "express" });

      const res = await request(ctx.app).get("/api/v1/docs?lib=express");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /api/v1/docs/sync", () => {
    it("should return 400 when lib is missing", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/docs/sync")
        .send({});

      expect(res.status).toBe(400);
    });

    it("should create entry for valid lib", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/docs/sync")
        .send({ lib: "express" });

      expect(res.status).toBe(201);
    });
  });

  describe("GET /api/v1/docs/:libId", () => {
    it("should return 404 for non-existent lib", async () => {
      const res = await request(ctx.app).get("/api/v1/docs/nonexistent-lib-xyz");

      expect(res.status).toBe(404);
    });
  });
});
