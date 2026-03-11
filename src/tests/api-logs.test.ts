import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { logger, clearLogBuffer } from "../core/utils/logger.js";

describe("Logs API", () => {
  let ctx: TestContext;

  beforeEach(() => {
    clearLogBuffer();
    vi.spyOn(console, "error").mockImplementation(() => {});
    ctx = createTestApp();
    // Clear logs generated during app initialization
    clearLogBuffer();
  });

  afterEach(() => {
    ctx.store.close();
    clearLogBuffer();
    vi.restoreAllMocks();
  });

  describe("GET /api/v1/logs", () => {
    it("should return empty logs initially", async () => {
      const res = await request(ctx.app).get("/api/v1/logs");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ logs: [], total: 0 });
    });

    it("should return logs after logging", async () => {
      logger.info("test log message");
      logger.warn("warning message");

      const res = await request(ctx.app).get("/api/v1/logs");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.logs[0].level).toBe("info");
      expect(res.body.logs[1].level).toBe("warn");
    });

    it("should filter by level", async () => {
      logger.info("info message");
      logger.error("error message");
      logger.warn("warn message");

      const res = await request(ctx.app).get("/api/v1/logs?level=error");

      expect(res.status).toBe(200);
      expect(res.body.logs).toHaveLength(1);
      expect(res.body.logs[0].level).toBe("error");
      expect(res.body.total).toBe(1);
    });

    it("should filter by since (cursor-based)", async () => {
      logger.info("first");
      const firstId = (await request(ctx.app).get("/api/v1/logs")).body.logs.find(
        (l: { message: string }) => l.message === "first",
      ).id;

      logger.info("second");
      logger.info("third");

      const res = await request(ctx.app).get(`/api/v1/logs?since=${firstId}`);

      expect(res.status).toBe(200);
      // Filter to only our test messages (exclude request-logger noise)
      const testLogs = res.body.logs.filter(
        (l: { message: string }) => ["second", "third"].includes(l.message),
      );
      expect(testLogs).toHaveLength(2);
      expect(testLogs[0].message).toBe("second");
      expect(testLogs[1].message).toBe("third");
    });

    it("should filter by search text", async () => {
      logger.info("database connection established");
      logger.info("user logged in");
      logger.error("database connection failed");

      const res = await request(ctx.app).get("/api/v1/logs?search=database");

      expect(res.status).toBe(200);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.logs[0].message).toContain("database");
      expect(res.body.logs[1].message).toContain("database");
    });
  });

  describe("DELETE /api/v1/logs", () => {
    it("should clear log buffer and return 204", async () => {
      logger.info("to be cleared");

      const before = await request(ctx.app).get("/api/v1/logs");
      expect(before.body.total).toBeGreaterThanOrEqual(1);

      const res = await request(ctx.app).delete("/api/v1/logs");
      expect(res.status).toBe(204);

      // Buffer was cleared by DELETE; the subsequent GET generates new request logs
      // but the original "to be cleared" entry should be gone
      const after = await request(ctx.app).get("/api/v1/logs");
      const cleared = after.body.logs.find(
        (l: { message: string }) => l.message === "to be cleared",
      );
      expect(cleared).toBeUndefined();
    });
  });
});
