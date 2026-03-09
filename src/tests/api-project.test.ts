import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/project", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/project", () => {
    it("should return the initialized project", async () => {
      const res = await request(ctx.app).get("/api/v1/project");

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test Project");
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it("should return 404 when no project is initialized", async () => {
      const store = SqliteStore.open(":memory:");
      const express = (await import("express")).default;
      const { createApiRouter } = await import("../api/router.js");

      const app = express();
      app.use(express.json());
      app.use("/api/v1", createApiRouter(store));

      const res = await request(app).get("/api/v1/project");
      expect(res.status).toBe(404);
      store.close();
    });
  });

  describe("POST /api/v1/project/init", () => {
    it("should initialize a project with custom name", async () => {
      const store = SqliteStore.open(":memory:");
      const express = (await import("express")).default;
      const { createApiRouter } = await import("../api/router.js");

      const app = express();
      app.use(express.json());
      app.use("/api/v1", createApiRouter(store));

      const res = await request(app)
        .post("/api/v1/project/init")
        .send({ name: "My Project" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("My Project");
      store.close();
    });

    it("should return existing project on duplicate init", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/project/init")
        .send({ name: "Another Name" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Test Project");
    });
  });
});
