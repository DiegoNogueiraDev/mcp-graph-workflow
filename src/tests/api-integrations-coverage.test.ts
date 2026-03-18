/**
 * Coverage tests for API integrations routes.
 * Tests memories CRUD, enriched context, and knowledge status.
 * Uses real in-memory SQLite store with temp directory for filesystem operations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import express from "express";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { createApiRouter } from "../api/router.js";

interface IntegrationTestContext {
  app: express.Express;
  store: SqliteStore;
  tmpDir: string;
}

function createTestAppWithBasePath(): IntegrationTestContext {
  const tmpDir = mkdtempSync(path.join(tmpdir(), "mcp-integ-test-"));
  const memoriesDir = path.join(tmpDir, "workflow-graph", "memories");
  mkdirSync(memoriesDir, { recursive: true });

  const store = SqliteStore.open(":memory:");
  store.initProject("Test Project");

  const app = express();
  app.use(express.json());
  app.use("/api/v1", createApiRouter({ store, basePath: tmpDir }));

  return { app, store, tmpDir };
}

describe("API /api/v1/integrations (coverage)", () => {
  let ctx: IntegrationTestContext;

  beforeEach(() => {
    ctx = createTestAppWithBasePath();
  });

  afterEach(() => {
    ctx.store.close();
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  });

  // ── GET /integrations/status ────────────────────

  describe("GET /api/v1/integrations/status", () => {
    it("should return integration status with expected keys", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("codeGraph");
      expect(res.body).toHaveProperty("memories");
      expect(res.body).toHaveProperty("playwright");
    });
  });

  // ── GET /integrations/memories ──────────────────

  describe("GET /api/v1/integrations/memories", () => {
    it("should return empty array initially", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/memories");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });
  });

  // ── POST /integrations/memories ─────────────────

  describe("POST /api/v1/integrations/memories", () => {
    it("should create a memory with name and content", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/integrations/memories")
        .send({ name: "test-memory", content: "This is a test memory" });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.name).toBe("test-memory");
    });

    it("should return 400 when name is missing", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/integrations/memories")
        .send({ content: "Content without name" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 when content is missing", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/integrations/memories")
        .send({ name: "no-content" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 when body is empty", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/integrations/memories")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── GET /integrations/memories/:name ────────────

  describe("GET /api/v1/integrations/memories/:name", () => {
    it("should return a previously created memory", async () => {
      await request(ctx.app)
        .post("/api/v1/integrations/memories")
        .send({ name: "fetch-me", content: "Fetch this content" });

      const res = await request(ctx.app)
        .get("/api/v1/integrations/memories/fetch-me");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("content");
      expect(res.body.content).toContain("Fetch this content");
    });

    it("should return 404 for nonexistent memory", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/memories/does-not-exist");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── DELETE /integrations/memories/:name ──────────

  describe("DELETE /api/v1/integrations/memories/:name", () => {
    it("should delete an existing memory", async () => {
      await request(ctx.app)
        .post("/api/v1/integrations/memories")
        .send({ name: "delete-me", content: "To be deleted" });

      const res = await request(ctx.app)
        .delete("/api/v1/integrations/memories/delete-me");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("should return 404 when deleting nonexistent memory", async () => {
      const res = await request(ctx.app)
        .delete("/api/v1/integrations/memories/ghost-memory");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("should confirm memory is gone after deletion", async () => {
      await request(ctx.app)
        .post("/api/v1/integrations/memories")
        .send({ name: "ephemeral", content: "Here then gone" });

      await request(ctx.app)
        .delete("/api/v1/integrations/memories/ephemeral");

      const res = await request(ctx.app)
        .get("/api/v1/integrations/memories/ephemeral");

      expect(res.status).toBe(404);
    });
  });

  // ── GET /integrations/serena/memories (backward compat) ──

  describe("GET /api/v1/integrations/serena/memories", () => {
    it("should return array via backward-compatible endpoint", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/serena/memories");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── GET /integrations/enriched-context/:symbol ──

  describe("GET /api/v1/integrations/enriched-context/:symbol", () => {
    it("should return enriched context for a symbol", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/enriched-context/testSymbol");

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  // ── GET /integrations/knowledge-status ──────────

  describe("GET /api/v1/integrations/knowledge-status", () => {
    it("should return total and sources array", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/knowledge-status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(typeof res.body.total).toBe("number");
      expect(res.body).toHaveProperty("sources");
      expect(Array.isArray(res.body.sources)).toBe(true);
    });

    it("should return zero total when no knowledge indexed", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/knowledge-status");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.sources).toHaveLength(0);
    });
  });
});
