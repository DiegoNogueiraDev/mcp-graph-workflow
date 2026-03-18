/**
 * Integration tests for GET /api/v1/benchmark route.
 * Uses real in-memory SQLite store via createTestApp().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";
import { ToolTokenStore } from "../core/store/tool-token-store.js";

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

  // ── Tool Token Usage ──────────────────────────

  it("should return toolTokenUsage as null when no calls recorded", async () => {
    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body).toHaveProperty("toolTokenUsage");
    expect(res.body.toolTokenUsage).not.toBeNull();
    expect(res.body.toolTokenUsage.totalCalls).toBe(0);
  });

  it("should return toolTokenUsage with perTool breakdown after recording", async () => {
    const project = ctx.store.getProject()!;
    const tokenStore = new ToolTokenStore(ctx.store.getDb());
    tokenStore.record(project.id, "list", 100, 200);
    tokenStore.record(project.id, "list", 150, 300);
    tokenStore.record(project.id, "context", 500, 1000);

    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body.toolTokenUsage.totalCalls).toBe(3);
    expect(res.body.toolTokenUsage.totalInputTokens).toBe(750);
    expect(res.body.toolTokenUsage.totalOutputTokens).toBe(1500);
    expect(res.body.toolTokenUsage.perTool).toHaveLength(2);

    const listStat = res.body.toolTokenUsage.perTool.find(
      (t: { toolName: string }) => t.toolName === "list",
    );
    expect(listStat.callCount).toBe(2);
    expect(listStat.totalTokens).toBe(750);
  });

  it("should include tool token formulas", async () => {
    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body.formulas).toHaveProperty("toolInputTokens");
    expect(res.body.formulas).toHaveProperty("toolOutputTokens");
  });

  // ── Layered Compression ─────────────────────────

  it("should include layeredCompression with all layer fields when tasks exist", async () => {
    ctx.store.insertNode(makeNode({ title: "Task A", description: "Build login screen" }));
    ctx.store.insertNode(makeNode({ title: "Task B", description: "Build signup flow" }));

    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body).toHaveProperty("layeredCompression");
    const lc = res.body.layeredCompression;
    expect(lc).not.toBeNull();
    expect(lc).toHaveProperty("avgNaiveNeighborhoodTokens");
    expect(lc).toHaveProperty("avgCompactContextTokens");
    expect(lc).toHaveProperty("avgNeighborTruncatedTokens");
    expect(lc).toHaveProperty("avgDefaultOmittedTokens");
    expect(lc).toHaveProperty("avgShortKeysTokens");
    expect(lc).toHaveProperty("avgSummaryTierTokens");
    expect(lc).toHaveProperty("avgLayer1SavingsPercent");
    expect(lc).toHaveProperty("avgLayer2SavingsPercent");
    expect(lc).toHaveProperty("avgLayer3SavingsPercent");
    expect(lc).toHaveProperty("avgLayer4SavingsPercent");
    expect(lc).toHaveProperty("avgTotalRealSavingsPercent");
    expect(lc).toHaveProperty("sampleSize");
    expect(lc.sampleSize).toBe(2);
  });

  it("should have layeredCompression as null for empty graph", async () => {
    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body).toHaveProperty("layeredCompression");
    expect(res.body.layeredCompression).toBeNull();
  });

  it("should have monotonically decreasing token counts across all layers", async () => {
    const parent = makeNode({ type: "epic", title: "Epic", description: "Epic description text for testing" });
    const task = makeNode({
      title: "Task with neighbors",
      description: "A task with a parent and description",
      parentId: parent.id,
      estimateMinutes: 120,
      tags: ["important"],
    });
    ctx.store.insertNode(parent);
    ctx.store.insertNode(task);

    const res = await request(ctx.app).get("/api/v1/benchmark");

    const lc = res.body.layeredCompression;
    expect(lc).not.toBeNull();
    expect(lc.avgNaiveNeighborhoodTokens).toBeGreaterThanOrEqual(lc.avgCompactContextTokens);
    expect(lc.avgCompactContextTokens).toBeGreaterThanOrEqual(lc.avgNeighborTruncatedTokens);
    expect(lc.avgNeighborTruncatedTokens).toBeGreaterThanOrEqual(lc.avgDefaultOmittedTokens);
    expect(lc.avgDefaultOmittedTokens).toBeGreaterThanOrEqual(lc.avgShortKeysTokens);
    expect(lc.avgShortKeysTokens).toBeGreaterThanOrEqual(lc.avgSummaryTierTokens);
  });

  it("should include layer formulas and key legend", async () => {
    const res = await request(ctx.app).get("/api/v1/benchmark");

    expect(res.body.formulas).toHaveProperty("layer1Savings");
    expect(res.body.formulas).toHaveProperty("layer2Savings");
    expect(res.body.formulas).toHaveProperty("layer3Savings");
    expect(res.body.formulas).toHaveProperty("layer4Savings");
    expect(res.body.formulas).toHaveProperty("keyLegend");
  });
});
