/**
 * Integration tests for GET /api/v1/benchmark route.
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/benchmark", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should return benchmark data for empty graph", async () => {
    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("tokenEconomy");
    expect(res.body).toHaveProperty("dependencyIntelligence");
  });

  it("should return tokenEconomy section with correct fields", async () => {
    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body.tokenEconomy).toHaveProperty("totalNodes");
    expect(res.body.tokenEconomy).toHaveProperty("totalEdges");
    expect(res.body.tokenEconomy).toHaveProperty("avgCompressionPercent");
  });

  it("should return dependencyIntelligence section", async () => {
    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body.dependencyIntelligence).toHaveProperty("totalEdges");
    expect(res.body.dependencyIntelligence).toHaveProperty("cycles");
  });

  it("should return formulas documentation section", async () => {
    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body).toHaveProperty("formulas");
  });

  it("should return perTaskMetrics when tasks exist", async () => {
    ctx.store.insertNode(makeNode({ title: "Task A", description: "Build login screen" }));
    ctx.store.insertNode(makeNode({ title: "Task B", description: "Build signup flow" }));

    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body.tokenEconomy).toHaveProperty("perTaskMetrics");
    expect(res.body.tokenEconomy.perTaskMetrics.length).toBe(2);

    const metric = res.body.tokenEconomy.perTaskMetrics[0];
    expect(metric).toHaveProperty("id");
    expect(metric).toHaveProperty("rawChars");
    expect(metric).toHaveProperty("compactChars");
    expect(metric).toHaveProperty("estimatedTokens");
  });
});
