/**
 * Extended backend tests for GitNexus API routes.
 * Tests edge cases, validation, and response shape consistency.
 * Complements the existing api-gitnexus.test.ts.
 */
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createGitNexusRouter } from "../api/routes/gitnexus.js";

describe("API /api/v1/gitnexus — extended", () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1/gitnexus", createGitNexusRouter({ basePath: "/tmp/fake-project" }));
  });

  // ── GET /status response shape ──────────────────

  describe("GET /status — response shape", () => {
    it("should include port in response", async () => {
      const res = await request(app).get("/api/v1/gitnexus/status");
      expect(res.body).toHaveProperty("port");
      expect(typeof res.body.port).toBe("number");
    });

    it("should include analyzePhase in response", async () => {
      const res = await request(app).get("/api/v1/gitnexus/status");
      expect(res.body).toHaveProperty("analyzePhase");
      expect(typeof res.body.analyzePhase).toBe("string");
    });

    it("should return consistent types across calls", async () => {
      const res1 = await request(app).get("/api/v1/gitnexus/status");
      const res2 = await request(app).get("/api/v1/gitnexus/status");

      expect(typeof res1.body.indexed).toBe(typeof res2.body.indexed);
      expect(typeof res1.body.running).toBe(typeof res2.body.running);
    });
  });

  // ── POST /query validation ──────────────────────

  describe("POST /query — validation", () => {
    it("should reject empty query string", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/query")
        .send({ query: "" });

      expect(res.status).toBe(400);
    });

    it("should reject missing body entirely", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/query")
        .send();

      expect(res.status).toBe(400);
    });

    it("should reject non-string query", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/query")
        .send({ query: 123 });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /context validation ────────────────────

  describe("POST /context — validation", () => {
    it("should reject empty symbol", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/context")
        .send({ symbol: "" });

      expect(res.status).toBe(400);
    });

    it("should reject null symbol", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/context")
        .send({ symbol: null });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /impact validation ─────────────────────

  describe("POST /impact — validation", () => {
    it("should reject empty symbol", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/impact")
        .send({ symbol: "" });

      expect(res.status).toBe(400);
    });

    it("should reject array as body", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/impact")
        .send([]);

      expect(res.status).toBe(400);
    });
  });

  // ── Error responses ─────────────────────────────

  describe("Error responses", () => {
    it("all 503 responses should include error field", async () => {
      const endpoints = [
        { path: "/query", body: { query: "test" } },
        { path: "/context", body: { symbol: "Test" } },
        { path: "/impact", body: { symbol: "Test" } },
      ];

      for (const ep of endpoints) {
        const res = await request(app)
          .post(`/api/v1/gitnexus${ep.path}`)
          .send(ep.body);

        if (res.status === 503) {
          expect(res.body).toHaveProperty("error");
          expect(typeof res.body.error).toBe("string");
        }
      }
    });

    it("all 400 responses should include error field", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/query")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });
});
