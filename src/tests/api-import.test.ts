import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import path from "node:path";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

const FIXTURES = path.join(import.meta.dirname, "fixtures");

describe("API /api/v1/import", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should import a markdown file", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/import")
      .attach("file", path.join(FIXTURES, "sample.md"));

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.nodesCreated).toBeGreaterThan(0);
    expect(res.body.edgesCreated).toBeGreaterThanOrEqual(0);
    expect(res.body.sourceFile).toBe("sample.md");
  });

  it("should import an HTML file", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/import")
      .attach("file", path.join(FIXTURES, "sample.html"));

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.nodesCreated).toBeGreaterThan(0);
  });

  it("should return 400 when no file is uploaded", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/import");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No file");
  });

  it("should return 409 on duplicate import without force", async () => {
    // First import
    await request(ctx.app)
      .post("/api/v1/import")
      .attach("file", path.join(FIXTURES, "sample.md"));

    // Second import — should conflict
    const res = await request(ctx.app)
      .post("/api/v1/import")
      .attach("file", path.join(FIXTURES, "sample.md"));

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("already imported");
  });

  it("should allow force re-import", async () => {
    // First import
    await request(ctx.app)
      .post("/api/v1/import")
      .attach("file", path.join(FIXTURES, "sample.md"));

    // Force re-import
    const res = await request(ctx.app)
      .post("/api/v1/import")
      .attach("file", path.join(FIXTURES, "sample.md"))
      .field("force", "true");

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.reimported).toBe(true);
    expect(res.body.previousNodesDeleted).toBeGreaterThan(0);
  });

  it("should reject unsupported file formats", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/import")
      .attach("file", Buffer.from("test"), { filename: "data.json", contentType: "application/json" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Unsupported");
  });

  it("should create nodes accessible via the nodes API", async () => {
    await request(ctx.app)
      .post("/api/v1/import")
      .attach("file", path.join(FIXTURES, "sample.md"));

    const nodesRes = await request(ctx.app).get("/api/v1/nodes");
    expect(nodesRes.status).toBe(200);
    expect(nodesRes.body.length).toBeGreaterThan(0);

    const titles = nodesRes.body.map((n: { title: string }) => n.title);
    expect(titles.some((t: string) => t.includes("Stripe") || t.includes("Payment"))).toBe(true);
  });
});
