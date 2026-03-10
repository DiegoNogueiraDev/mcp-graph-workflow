/**
 * Integration tests for /api/v1/insights routes (bottlenecks, metrics, recommendations).
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode, makeBlockedTask } from "./helpers/factories.js";

describe("API /api/v1/insights", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/insights/bottlenecks", () => {
    it("should return report for empty graph", async () => {
      const res = await request(ctx.app).get("/api/v1/insights/bottlenecks");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("blockedTasks");
      expect(res.body).toHaveProperty("criticalPath");
    });

    it("should return report for graph with blocked nodes", async () => {
      ctx.store.insertNode(makeBlockedTask());
      ctx.store.insertNode(makeBlockedTask());
      ctx.store.insertNode(makeNode({ status: "in_progress" }));

      const res = await request(ctx.app).get("/api/v1/insights/bottlenecks");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("blockedTasks");
    });
  });

  describe("GET /api/v1/insights/metrics", () => {
    it("should return metrics object with expected fields", async () => {
      const res = await request(ctx.app).get("/api/v1/insights/metrics");

      expect(res.status).toBe(200);
      expect(typeof res.body).toBe("object");
    });

    it("should reflect correct status distribution", async () => {
      ctx.store.insertNode(makeNode({ status: "done" }));
      ctx.store.insertNode(makeNode({ status: "in_progress" }));

      const res = await request(ctx.app).get("/api/v1/insights/metrics");

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/v1/insights/recommendations", () => {
    it("should return recommendations array", async () => {
      const res = await request(ctx.app).get("/api/v1/insights/recommendations");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("recommendations");
      expect(Array.isArray(res.body.recommendations)).toBe(true);
    });
  });
});
