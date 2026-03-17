import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createGitNexusRouter } from "../api/routes/gitnexus.js";

describe("API /api/v1/gitnexus — basePath in status", () => {
  const fakePath = "/tmp/fake-project-bp-test";

  describe("GET /api/v1/gitnexus/status — static basePath", () => {
    let app: ReturnType<typeof express>;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use(
        "/api/v1/gitnexus",
        createGitNexusRouter({ getBasePath: () => fakePath }),
      );
    });

    it("should include basePath matching the configured project path", async () => {
      const res = await request(app).get("/api/v1/gitnexus/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("basePath");
      expect(res.body.basePath).toBe(fakePath);
    });

    it("should include serveBasePath field (null when serve not started)", async () => {
      const res = await request(app).get("/api/v1/gitnexus/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("serveBasePath");
      // serveBasePath can be null or a string depending on whether serve is running
      expect([null, "string"]).toContain(
        res.body.serveBasePath === null ? null : typeof res.body.serveBasePath,
      );
    });

    it("should include indexed boolean flag", async () => {
      const res = await request(app).get("/api/v1/gitnexus/status");

      expect(res.status).toBe(200);
      expect(typeof res.body.indexed).toBe("boolean");
    });

    it("should include analyzePhase field", async () => {
      const res = await request(app).get("/api/v1/gitnexus/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("analyzePhase");
    });
  });

  describe("GET /api/v1/gitnexus/status — dynamic basePath", () => {
    it("should reflect updated basePath when getBasePath changes", async () => {
      let currentPath = "/tmp/project-alpha";
      const app = express();
      app.use(express.json());
      app.use(
        "/api/v1/gitnexus",
        createGitNexusRouter({ getBasePath: () => currentPath }),
      );

      // First request — should return project-alpha
      const res1 = await request(app).get("/api/v1/gitnexus/status");
      expect(res1.body.basePath).toBe("/tmp/project-alpha");

      // Simulate project swap — basePath changes
      currentPath = "/tmp/project-beta";

      // Second request — should return project-beta
      const res2 = await request(app).get("/api/v1/gitnexus/status");
      expect(res2.body.basePath).toBe("/tmp/project-beta");
    });
  });
});
