/**
 * Coverage tests for API code-graph routes.
 * Tests the full HTTP request path: Express → router → core code modules.
 * Uses real in-memory SQLite store — no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/code-graph (coverage)", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /code-graph/status ──────────────────────

  describe("GET /api/v1/code-graph/status", () => {
    it("should return indexed:false when no code has been indexed", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/status");

      expect(res.status).toBe(200);
      expect(res.body.indexed).toBe(false);
      expect(res.body.symbolCount).toBe(0);
      expect(res.body.relationCount).toBe(0);
      expect(res.body.fileCount).toBe(0);
      expect(res.body.lastIndexed).toBeNull();
      expect(res.body.gitHash).toBeNull();
    });

    it("should include basePath in status response", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("basePath");
      expect(typeof res.body.basePath).toBe("string");
    });

    it("should include typescriptAvailable field in status response", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("typescriptAvailable");
      expect(typeof res.body.typescriptAvailable).toBe("boolean");
    });
  });

  // ── POST /code-graph/reindex ────────────────────

  describe("POST /api/v1/code-graph/reindex", () => {
    it("should return success with indexing result", { timeout: 30_000 }, async () => {
      const res = await request(ctx.app).post("/api/v1/code-graph/reindex");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("fileCount");
      expect(res.body).toHaveProperty("symbolCount");
      expect(res.body).toHaveProperty("relationCount");
    });

    it("should include typescriptAvailable field in reindex response", { timeout: 30_000 }, async () => {
      const res = await request(ctx.app).post("/api/v1/code-graph/reindex");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("typescriptAvailable");
      expect(typeof res.body.typescriptAvailable).toBe("boolean");
    });
  });

  // ── POST /code-graph/search ─────────────────────

  describe("POST /api/v1/code-graph/search", () => {
    it("should return results array for valid query", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/search")
        .send({ query: "test" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("results");
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    it("should return 400 for empty body", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/search")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 for missing query field", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/search")
        .send({ limit: 10 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── POST /code-graph/context ────────────────────

  describe("POST /api/v1/code-graph/context", () => {
    it("should return context for a valid symbol", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/context")
        .send({ symbol: "test" });

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it("should return 400 when symbol is missing", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/context")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── POST /code-graph/impact ─────────────────────

  describe("POST /api/v1/code-graph/impact", () => {
    it("should return impact analysis for a valid symbol", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/impact")
        .send({ symbol: "test" });

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it("should return 400 when symbol is missing", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/impact")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── GET /code-graph/full ────────────────────────

  describe("GET /api/v1/code-graph/full", () => {
    it("should return graph data structure", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/full");

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it("should accept optional limit query parameter", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/full?limit=10");

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  // ── GET /code-graph/processes ───────────────────

  describe("GET /api/v1/code-graph/processes", () => {
    it("should return processes array", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/processes");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("processes");
      expect(Array.isArray(res.body.processes)).toBe(true);
    });
  });
});
