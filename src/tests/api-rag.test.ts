/**
 * Integration tests for /api/v1/rag routes (query, reindex, stats).
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/rag", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("POST /api/v1/rag/query", () => {
    it("should return 400 when query field is missing", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/rag/query")
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return results for valid query after inserting nodes", async () => {
      ctx.store.insertNode(makeNode({ title: "Authentication system", description: "JWT token auth" }));
      ctx.store.insertNode(makeNode({ title: "Database migration", description: "Schema updates" }));

      // Reindex first to build embeddings
      await request(ctx.app).post("/api/v1/rag/reindex");

      const res = await request(ctx.app)
        .post("/api/v1/rag/query")
        .send({ query: "authentication" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("results");
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    it("should return similarity scores in results", async () => {
      ctx.store.insertNode(makeNode({ title: "User login flow", description: "Login with email and password" }));
      await request(ctx.app).post("/api/v1/rag/reindex");

      const res = await request(ctx.app)
        .post("/api/v1/rag/query")
        .send({ query: "login" });

      expect(res.status).toBe(200);
      if (res.body.results.length > 0) {
        expect(res.body.results[0]).toHaveProperty("similarity");
      }
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        ctx.store.insertNode(makeNode({ title: `Feature item ${i}`, description: `Description for feature ${i}` }));
      }
      await request(ctx.app).post("/api/v1/rag/reindex");

      const res = await request(ctx.app)
        .post("/api/v1/rag/query")
        .send({ query: "feature", limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("POST /api/v1/rag/reindex", () => {
    it("should rebuild embeddings and return ok", async () => {
      ctx.store.insertNode(makeNode({ title: "Test node" }));

      const res = await request(ctx.app).post("/api/v1/rag/reindex");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ok", true);
      expect(res.body).toHaveProperty("indexed");
    });
  });

  describe("GET /api/v1/rag/stats", () => {
    it("should return totalEmbeddings and indexed flag", async () => {
      const res = await request(ctx.app).get("/api/v1/rag/stats");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalEmbeddings");
      expect(res.body).toHaveProperty("indexed");
    });
  });
});
