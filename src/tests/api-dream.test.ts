import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("Dream API routes", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/dream/status", () => {
    it("should return DreamStatus with running=false when idle", async () => {
      const res = await request(ctx.app).get("/api/v1/dream/status");
      expect(res.status).toBe(200);
      expect(res.body.running).toBe(false);
    });
  });

  describe("GET /api/v1/dream/history", () => {
    it("should return empty array when no cycles exist", async () => {
      const res = await request(ctx.app).get("/api/v1/dream/history");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/v1/dream/history/:id", () => {
    it("should return 404 for non-existent cycle ID", async () => {
      const res = await request(ctx.app).get("/api/v1/dream/history/nonexistent");
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("GET /api/v1/dream/metrics", () => {
    it("should return zeroed metrics when no cycles exist", async () => {
      const res = await request(ctx.app).get("/api/v1/dream/metrics");
      expect(res.status).toBe(200);
      expect(res.body.totalCycles).toBe(0);
      expect(res.body.totalPruned).toBe(0);
      expect(res.body.totalMerged).toBe(0);
    });
  });

  describe("POST /api/v1/dream/cycle", () => {
    it("should start a dream cycle and return cycleId with status 202", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/dream/cycle")
        .send({});
      expect(res.status).toBe(202);
      expect(res.body.ok).toBe(true);
      expect(res.body.cycleId).toBeDefined();
    });

    it("should reject invalid config with 400", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/dream/cycle")
        .send({ pruneThreshold: 5 }); // out of range 0-1
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/dream/cycle/cancel", () => {
    it("should return ok when no cycle is running", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/dream/cycle/cancel")
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe("GET /api/v1/dream/preview", () => {
    it("should return a dry-run cycle result", async () => {
      const res = await request(ctx.app).get("/api/v1/dream/preview");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("completed");
      expect(res.body.config.dryRun).toBe(true);
    });
  });
});
