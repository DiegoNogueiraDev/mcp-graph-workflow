import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createGitNexusRouter } from "../api/routes/gitnexus.js";

describe("API /api/v1/gitnexus", () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1/gitnexus", createGitNexusRouter({ getBasePath: () => "/tmp/fake-project" }));
  });

  // ── GET /status ───────────────────────────────

  describe("GET /api/v1/gitnexus/status", () => {
    it("should return status object with indexed and running flags", async () => {
      const res = await request(app).get("/api/v1/gitnexus/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("indexed");
      expect(res.body).toHaveProperty("running");
      expect(typeof res.body.indexed).toBe("boolean");
      expect(typeof res.body.running).toBe("boolean");
    });

    it("should report not indexed for non-existent project path", async () => {
      const res = await request(app).get("/api/v1/gitnexus/status");

      expect(res.body.indexed).toBe(false);
    });
  });

  // ── POST /query ───────────────────────────────

  describe("POST /api/v1/gitnexus/query", () => {
    it("should return 503 when gitnexus is not running", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/query")
        .send({ query: "find all functions" });

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/not running|not available/i);
    });

    it("should require query field in body", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/query")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── POST /context ─────────────────────────────

  describe("POST /api/v1/gitnexus/context", () => {
    it("should return 503 when gitnexus is not running", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/context")
        .send({ symbol: "GraphStore" });

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("error");
    });

    it("should require symbol field in body", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/context")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── POST /impact ──────────────────────────────

  describe("POST /api/v1/gitnexus/impact", () => {
    it("should return 503 when gitnexus is not running", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/impact")
        .send({ symbol: "GraphStore" });

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("error");
    });

    it("should require symbol field in body", async () => {
      const res = await request(app)
        .post("/api/v1/gitnexus/impact")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });
});
