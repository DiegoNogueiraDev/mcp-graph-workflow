import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";

describe("Context API — coverage", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /context/preview ─────────────────────────────

  it("should return 400 when nodeId is missing", async () => {
    const res = await request(ctx.app).get("/api/v1/context/preview");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("nodeId");
  });

  it("should return 404 when node does not exist", async () => {
    const res = await request(ctx.app).get(
      "/api/v1/context/preview?nodeId=nonexistent",
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("nonexistent");
  });

  it("should return task context for existing node", async () => {
    const node = makeNode({ title: "Context test task" });
    ctx.store.insertNode(node);

    const res = await request(ctx.app).get(
      `/api/v1/context/preview?nodeId=${node.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("task");
    expect(res.body.task.id).toBe(node.id);
    expect(res.body).toHaveProperty("metrics");
  });

  it("should include children and blockers in context", async () => {
    const parent = makeNode({ title: "Parent task", type: "epic" });
    const child = makeNode({ title: "Child task", parentId: parent.id });
    ctx.store.insertNode(parent);
    ctx.store.insertNode(child);

    const res = await request(ctx.app).get(
      `/api/v1/context/preview?nodeId=${parent.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.children.length).toBeGreaterThanOrEqual(1);
  });

  // ── GET /context/budget ──────────────────────────────

  it("should return token budget breakdown", async () => {
    const res = await request(ctx.app).get("/api/v1/context/budget");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalTokens");
    expect(res.body).toHaveProperty("activeTokens");
    expect(res.body).toHaveProperty("totalCount");
    expect(res.body).toHaveProperty("activeCount");
    expect(res.body).toHaveProperty("health");
    expect(res.body).toHaveProperty("healthMessage");
    expect(res.body).toHaveProperty("recommendations");
    expect(res.body).toHaveProperty("breakdown");
    expect(Array.isArray(res.body.breakdown)).toBe(true);
    expect(["green", "yellow", "red"]).toContain(res.body.health);
  });

  it("should sort breakdown by token size descending", async () => {
    const res = await request(ctx.app).get("/api/v1/context/budget");
    expect(res.status).toBe(200);
    const tokens = res.body.breakdown.map((b: { tokens: number }) => b.tokens);
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i - 1]).toBeGreaterThanOrEqual(tokens[i]);
    }
  });

  it("should include built-in skills in breakdown", async () => {
    const res = await request(ctx.app).get("/api/v1/context/budget");
    expect(res.status).toBe(200);
    const sources = res.body.breakdown.map(
      (b: { source: string }) => b.source,
    );
    expect(sources).toContain("built-in");
  });
});
