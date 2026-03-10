/**
 * Integration tests for API integrations routes.
 * Tests the full HTTP request path: Express → router → core modules.
 * Uses real in-memory SQLite store — no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/integrations", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /integrations/status ────────────────────

  describe("GET /api/v1/integrations/status", () => {
    it("should return status object with gitnexus, serena, playwright keys", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("gitnexus");
      expect(res.body).toHaveProperty("serena");
      expect(res.body).toHaveProperty("playwright");
    });

    it("should have boolean installed/running flags for each integration", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/status");

      expect(typeof res.body.gitnexus.installed).toBe("boolean");
      expect(typeof res.body.gitnexus.running).toBe("boolean");
      expect(typeof res.body.serena.installed).toBe("boolean");
    });
  });

  // ── GET /integrations/serena/memories ───────────

  describe("GET /api/v1/integrations/serena/memories", () => {
    it("should return array (possibly empty if no .serena dir)", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/serena/memories");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("each memory should have name and content fields", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/serena/memories");

      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("name");
        expect(res.body[0]).toHaveProperty("content");
        expect(typeof res.body[0].name).toBe("string");
        expect(typeof res.body[0].content).toBe("string");
      }
    });
  });

  // ── GET /integrations/serena/memories/:name ─────

  describe("GET /api/v1/integrations/serena/memories/:name", () => {
    it("should return 404 for non-existent memory", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/serena/memories/nonexistent-xyz");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── GET /integrations/knowledge-status ──────────

  describe("GET /api/v1/integrations/knowledge-status", () => {
    it("should return knowledge status with total count", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/knowledge-status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(typeof res.body.total).toBe("number");
      expect(res.body).toHaveProperty("sources");
      expect(Array.isArray(res.body.sources)).toBe(true);
    });
  });
});
