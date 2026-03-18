/**
 * Coverage tests for API project routes.
 * Tests the full HTTP request path: Express → router → store project methods.
 * Uses real in-memory SQLite store — no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/project (coverage)", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /project ────────────────────────────────

  describe("GET /api/v1/project", () => {
    it("should return the current project with id, name, and createdAt", async () => {
      const res = await request(ctx.app).get("/api/v1/project");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("createdAt");
      expect(res.body.name).toBe("Test Project");
    });
  });

  // ── POST /project/init ──────────────────────────

  describe("POST /api/v1/project/init", () => {
    it("should create a new project with provided name", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/project/init")
        .send({ name: "Coverage Project" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Coverage Project");
      expect(res.body).toHaveProperty("id");
    });

    it("should create project with default name when no name is provided", async () => {
      const store = SqliteStore.open(":memory:");
      const express = (await import("express")).default;
      const { createApiRouter } = await import("../api/router.js");

      const app = express();
      app.use(express.json());
      app.use("/api/v1", createApiRouter(store));

      const res = await request(app)
        .post("/api/v1/project/init")
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("name");
      store.close();
    });
  });

  // ── GET /project/active ─────────────────────────

  describe("GET /api/v1/project/active", () => {
    it("should return the active project", async () => {
      const res = await request(ctx.app).get("/api/v1/project/active");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("name");
      expect(res.body.name).toBe("Test Project");
    });
  });

  // ── GET /project/list ───────────────────────────

  describe("GET /api/v1/project/list", () => {
    it("should return list with at least one project", async () => {
      const res = await request(ctx.app).get("/api/v1/project/list");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty("projects");
      expect(Array.isArray(res.body.projects)).toBe(true);
    });

    it("should include all created projects", async () => {
      await request(ctx.app)
        .post("/api/v1/project/init")
        .send({ name: "Second Project" });

      const res = await request(ctx.app).get("/api/v1/project/list");

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });
  });

  // ── POST /project/:id/activate ──────────────────

  describe("POST /api/v1/project/:id/activate", () => {
    it("should activate an existing project", async () => {
      const initRes = await request(ctx.app)
        .post("/api/v1/project/init")
        .send({ name: "Activate Me" });

      const projectId = initRes.body.id;
      const res = await request(ctx.app)
        .post(`/api/v1/project/${projectId}/activate`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body).toHaveProperty("project");
    });

    it("should return error for nonexistent project id", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/project/nonexistent-id-12345/activate");

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ── Edge case: no project initialized ───────────

  describe("No project initialized", () => {
    it("should return 404 on GET /project when store has no project", async () => {
      const store = SqliteStore.open(":memory:");
      const express = (await import("express")).default;
      const { createApiRouter } = await import("../api/router.js");

      const app = express();
      app.use(express.json());
      app.use("/api/v1", createApiRouter(store));

      const res = await request(app).get("/api/v1/project");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
      store.close();
    });

    it("should return 404 on GET /project/active when no project active", async () => {
      const store = SqliteStore.open(":memory:");
      const express = (await import("express")).default;
      const { createApiRouter } = await import("../api/router.js");

      const app = express();
      app.use(express.json());
      app.use("/api/v1", createApiRouter(store));

      const res = await request(app).get("/api/v1/project/active");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
      store.close();
    });
  });
});
