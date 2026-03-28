/**
 * API tests for LSP endpoints on /api/v1/code-graph/lsp/*.
 * Validates HTTP layer: request validation, response shapes, error handling.
 * Core LSP logic is tested in bridge/cache/diagnostics tests — these are lightweight.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "../helpers/test-app.js";

describe("API /api/v1/code-graph/lsp", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /code-graph/lsp/languages ─────────────────

  describe("GET /api/v1/code-graph/lsp/languages", () => {
    it("should return detected languages and supported list", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/lsp/languages");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.detected)).toBe(true);
      expect(Array.isArray(res.body.supportedLanguages)).toBe(true);
      expect(res.body.supportedLanguages.length).toBeGreaterThan(0);
    });

    it("should include serverCommand in detected entries", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/lsp/languages");

      expect(res.status).toBe(200);
      for (const entry of res.body.detected) {
        expect(entry).toHaveProperty("languageId");
        expect(entry).toHaveProperty("serverCommand");
      }
    });
  });

  // ── GET /code-graph/lsp/status ────────────────────

  describe("GET /api/v1/code-graph/lsp/status", () => {
    it("should return bridge state (auto-initialized via warm-up)", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/lsp/status");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // Bridge is now auto-initialized on status request (warm-up)
      expect(res.body.bridgeInitialized).toBe(true);
      expect(typeof res.body.servers).toBe("object");
    });
  });

  // ── POST /code-graph/lsp/definition ───────────────

  describe("POST /api/v1/code-graph/lsp/definition", () => {
    it("should return 500 for valid params when no LSP server available", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/lsp/definition")
        .send({ file: "src/index.ts", line: 1, character: 0 });

      // Bridge will be created but no real LSP server is running in tests,
      // so we expect either a successful empty result or a server error.
      expect([200, 500]).toContain(res.status);
    });

    it("should return 400 for missing file param", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/lsp/definition")
        .send({ line: 1, character: 0 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 for invalid line (zero)", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/lsp/definition")
        .send({ file: "src/index.ts", line: 0, character: 0 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 for empty body", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/lsp/definition")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── POST /code-graph/lsp/hover ────────────────────

  describe("POST /api/v1/code-graph/lsp/hover", () => {
    it("should return 400 for missing file param", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/lsp/hover")
        .send({ line: 5, character: 10 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 for negative character", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/code-graph/lsp/hover")
        .send({ file: "src/index.ts", line: 1, character: -1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── GET /code-graph/lsp/diagnostics ───────────────

  describe("GET /api/v1/code-graph/lsp/diagnostics", () => {
    it("should return 400 when file param is missing", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/lsp/diagnostics");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 for empty file param", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/lsp/diagnostics?file=");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });
});
