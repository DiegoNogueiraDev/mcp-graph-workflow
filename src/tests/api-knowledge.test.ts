import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/knowledge", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── POST / — upload ────────────────────────────

  describe("POST /api/v1/knowledge", () => {
    it("should upload a knowledge document", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/knowledge")
        .send({
          title: "API Guide",
          content: "REST API best practices for building APIs",
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].title).toBe("API Guide");
      expect(res.body.chunksCreated).toBe(1);
    });

    it("should chunk large documents", async () => {
      const content = "This is a sentence with enough words. ".repeat(300);

      const res = await request(ctx.app)
        .post("/api/v1/knowledge")
        .send({ title: "Large Doc", content });

      expect(res.status).toBe(201);
      expect(res.body.chunksCreated).toBeGreaterThan(1);
    });

    it("should accept sourceType and metadata", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/knowledge")
        .send({
          title: "Project Memory",
          content: "Important memory content",
          sourceType: "memory",
          sourceId: "mem-001",
          metadata: { importance: "high" },
        });

      expect(res.status).toBe(201);
      expect(res.body.documents[0].sourceType).toBe("memory");
    });

    it("should reject empty title", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/knowledge")
        .send({ title: "", content: "Some content" });

      expect(res.status).toBe(400);
    });

    it("should reject missing content", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/knowledge")
        .send({ title: "Title" });

      expect(res.status).toBe(400);
    });
  });

  // ── GET / — list ───────────────────────────────

  describe("GET /api/v1/knowledge", () => {
    beforeEach(async () => {
      await request(ctx.app).post("/api/v1/knowledge").send({ title: "Doc A", content: "Content A" });
      await request(ctx.app).post("/api/v1/knowledge").send({
        title: "Doc B", content: "Content B", sourceType: "docs",
      });
    });

    it("should list all documents", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge");

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it("should filter by sourceType", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge?sourceType=docs");

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].sourceType).toBe("docs");
    });

    it("should support limit and offset", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge?limit=1&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(1);
    });
  });

  // ── POST /search — FTS ─────────────────────────

  describe("POST /api/v1/knowledge/search", () => {
    beforeEach(async () => {
      await request(ctx.app).post("/api/v1/knowledge").send({
        title: "Express Guide", content: "Express is a Node.js web framework for building APIs",
      });
      await request(ctx.app).post("/api/v1/knowledge").send({
        title: "React Tutorial", content: "React is a JavaScript library for building UIs",
      });
    });

    it("should search by content", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/knowledge/search")
        .send({ query: "web framework" });

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThanOrEqual(1);
      expect(res.body.results[0].title).toBe("Express Guide");
    });

    it("should reject missing query", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/knowledge/search")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── GET /:id — get by ID ──────────────────────

  describe("GET /api/v1/knowledge/:id", () => {
    it("should get a document by ID", async () => {
      const uploadRes = await request(ctx.app)
        .post("/api/v1/knowledge")
        .send({ title: "Test", content: "Test content" });

      const docId = uploadRes.body.documents[0].id;
      const res = await request(ctx.app).get(`/api/v1/knowledge/${docId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(docId);
    });

    it("should return 404 for non-existent ID", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge/kdoc_nonexistent");

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /:id ────────────────────────────────

  describe("DELETE /api/v1/knowledge/:id", () => {
    it("should delete a document", async () => {
      const uploadRes = await request(ctx.app)
        .post("/api/v1/knowledge")
        .send({ title: "To Delete", content: "Will be deleted" });

      const docId = uploadRes.body.documents[0].id;
      const res = await request(ctx.app).delete(`/api/v1/knowledge/${docId}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ── GET /stats/summary ─────────────────────────

  describe("GET /api/v1/knowledge/stats/summary", () => {
    it("should return stats", async () => {
      await request(ctx.app).post("/api/v1/knowledge").send({ title: "A", content: "A content" });
      await request(ctx.app).post("/api/v1/knowledge").send({
        title: "B", content: "B content", sourceType: "docs",
      });

      const res = await request(ctx.app).get("/api/v1/knowledge/stats/summary");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.bySource.upload).toBe(1);
      expect(res.body.bySource.docs).toBe(1);
    });
  });
});
