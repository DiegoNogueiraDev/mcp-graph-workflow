/**
 * Integration tests for GET /api/v1/skills route.
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/skills", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should return 200 status code", async () => {
    const res = await request(ctx.app).get("/api/v1/skills");
    expect(res.status).toBe(200);
  });

  it("should return object with skills array and totalTokens", async () => {
    const res = await request(ctx.app).get("/api/v1/skills");
    expect(res.body).toHaveProperty("skills");
    expect(Array.isArray(res.body.skills)).toBe(true);
    expect(res.body).toHaveProperty("totalTokens");
    expect(typeof res.body.totalTokens).toBe("number");
  });

  it("should return skills with name and estimatedTokens fields", async () => {
    const res = await request(ctx.app).get("/api/v1/skills");
    const { skills } = res.body;

    if (skills.length > 0) {
      expect(skills[0]).toHaveProperty("name");
      expect(typeof skills[0].name).toBe("string");
      expect(skills[0]).toHaveProperty("estimatedTokens");
      expect(typeof skills[0].estimatedTokens).toBe("number");
      expect(skills[0].estimatedTokens).toBeGreaterThan(0);
    }
  });

  it("should have totalTokens equal to sum of all estimatedTokens", async () => {
    const res = await request(ctx.app).get("/api/v1/skills");
    const { skills, totalTokens } = res.body;
    const sum = skills.reduce((acc: number, s: { estimatedTokens: number }) => acc + s.estimatedTokens, 0);
    expect(totalTokens).toBe(sum);
  });

  it("should filter by phase", async () => {
    const res = await request(ctx.app).get("/api/v1/skills?phase=ANALYZE");
    const { skills } = res.body;
    expect(skills.length).toBe(3);
    expect(skills.every((s: { source: string }) => s.source === "built-in")).toBe(true);
  });

  it("should filter by source", async () => {
    const res = await request(ctx.app).get("/api/v1/skills?source=built-in");
    const { skills } = res.body;
    expect(skills.length).toBe(19);
    expect(skills.every((s: { source: string }) => s.source === "built-in")).toBe(true);
  });
});
