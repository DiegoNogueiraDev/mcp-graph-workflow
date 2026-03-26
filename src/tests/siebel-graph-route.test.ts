import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SAMPLE_SIF_PATH = resolve(import.meta.dirname, "./fixtures/sample.sif");
const SAMPLE_SIF_CONTENT = readFileSync(SAMPLE_SIF_PATH, "utf-8");

describe("API /api/v1/siebel/graph", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /siebel/graph ──────────────────────────

  describe("GET /api/v1/siebel/graph", () => {
    it("should return empty result when no SIF imported", async () => {
      const res = await request(ctx.app).get("/api/v1/siebel/graph");

      expect(res.status).toBe(200);
      expect(res.body.objects).toEqual([]);
      expect(res.body.dependencies).toEqual([]);
      expect(res.body.metadata).toBeNull();
    });

    it("should return objects and dependencies after importing a SIF", async () => {
      // Import first
      await request(ctx.app)
        .post("/api/v1/siebel/import")
        .send({ content: SAMPLE_SIF_CONTENT, fileName: "test.sif", mapToGraph: false });

      // Then GET graph
      const res = await request(ctx.app).get("/api/v1/siebel/graph");

      expect(res.status).toBe(200);
      expect(res.body.objects.length).toBeGreaterThan(0);
      expect(res.body.dependencies.length).toBeGreaterThan(0);
      expect(res.body.metadata).toBeDefined();
      expect(res.body.metadata.fileName).toBe("test.sif");

      // Verify object structure
      const applet = res.body.objects.find(
        (o: { name: string; type: string }) => o.type === "applet" && o.name === "Account List Applet",
      );
      expect(applet).toBeDefined();
      expect(applet.project).toBe("Account (SSE)");
    });
  });

  // ── POST /siebel/import enriched response ──────

  describe("POST /api/v1/siebel/import — enriched response", () => {
    it("should include objects and dependencies arrays in response", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/siebel/import")
        .send({ content: SAMPLE_SIF_CONTENT, fileName: "test.sif", mapToGraph: false });

      expect(res.status).toBe(201);
      expect(res.body.objectCount).toBeGreaterThan(0);
      expect(res.body.dependencyCount).toBeGreaterThan(0);

      // New enriched fields
      expect(res.body.objects).toBeDefined();
      expect(Array.isArray(res.body.objects)).toBe(true);
      expect(res.body.objects.length).toBe(res.body.objectCount);

      expect(res.body.dependencies).toBeDefined();
      expect(Array.isArray(res.body.dependencies)).toBe(true);
      expect(res.body.dependencies.length).toBe(res.body.dependencyCount);
    });

    it("should store raw SIF content for later retrieval", async () => {
      await request(ctx.app)
        .post("/api/v1/siebel/import")
        .send({ content: SAMPLE_SIF_CONTENT, fileName: "test.sif", mapToGraph: false });

      // Verify raw content is stored by fetching the graph endpoint
      const graphRes = await request(ctx.app).get("/api/v1/siebel/graph");

      expect(graphRes.status).toBe(200);
      expect(graphRes.body.objects.length).toBeGreaterThan(0);
    });
  });
});
