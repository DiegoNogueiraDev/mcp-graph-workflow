import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { ToolTokenStore } from "../core/store/tool-token-store.js";

describe("ToolTokenStore", () => {
  let sqliteStore: SqliteStore;
  let tokenStore: ToolTokenStore;
  let projectId: string;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    const project = sqliteStore.initProject("Test Project");
    projectId = project.id;
    tokenStore = new ToolTokenStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  describe("record", () => {
    it("should record and retrieve a tool token entry", () => {
      tokenStore.record(projectId, "list", 120, 350);

      const recent = tokenStore.getRecentCalls(projectId, 10);
      expect(recent).toHaveLength(1);
      expect(recent[0].toolName).toBe("list");
      expect(recent[0].inputTokens).toBe(120);
      expect(recent[0].outputTokens).toBe(350);
      expect(recent[0].projectId).toBe(projectId);
      expect(recent[0].calledAt).toBeTruthy();
    });
  });

  describe("getPerToolStats", () => {
    it("should compute per-tool aggregates correctly", () => {
      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(projectId, "list", 150, 300);
      tokenStore.record(projectId, "context", 500, 1000);

      const stats = tokenStore.getPerToolStats(projectId);
      expect(stats).toHaveLength(2);

      const listStats = stats.find((s) => s.toolName === "list")!;
      expect(listStats.callCount).toBe(2);
      expect(listStats.totalInputTokens).toBe(250);
      expect(listStats.totalOutputTokens).toBe(500);
      expect(listStats.avgInputTokens).toBe(125);
      expect(listStats.avgOutputTokens).toBe(250);
      expect(listStats.totalTokens).toBe(750);

      const ctxStats = stats.find((s) => s.toolName === "context")!;
      expect(ctxStats.callCount).toBe(1);
      expect(ctxStats.totalTokens).toBe(1500);
    });

    it("should compute correct averages with multiple calls", () => {
      tokenStore.record(projectId, "next", 10, 20);
      tokenStore.record(projectId, "next", 30, 40);
      tokenStore.record(projectId, "next", 50, 60);

      const stats = tokenStore.getPerToolStats(projectId);
      const nextStats = stats.find((s) => s.toolName === "next")!;
      expect(nextStats.avgInputTokens).toBe(30);
      expect(nextStats.avgOutputTokens).toBe(40);
    });
  });

  describe("getRecentCalls", () => {
    it("should return recent calls in descending order", () => {
      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(projectId, "context", 500, 1000);
      tokenStore.record(projectId, "next", 50, 100);

      const recent = tokenStore.getRecentCalls(projectId, 10);
      expect(recent).toHaveLength(3);
      // Most recent first
      expect(recent[0].toolName).toBe("next");
      expect(recent[2].toolName).toBe("list");
    });
  });

  describe("getSummary", () => {
    it("should handle empty project", () => {
      const summary = tokenStore.getSummary(projectId);
      expect(summary.totalCalls).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.perTool).toHaveLength(0);
      expect(summary.recentCalls).toHaveLength(0);
    });

    it("should return complete summary with data", () => {
      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(projectId, "list", 150, 300);
      tokenStore.record(projectId, "context", 500, 1000);

      const summary = tokenStore.getSummary(projectId);
      expect(summary.totalCalls).toBe(3);
      expect(summary.totalInputTokens).toBe(750);
      expect(summary.totalOutputTokens).toBe(1500);
      expect(summary.perTool).toHaveLength(2);
      expect(summary.recentCalls).toHaveLength(3);
    });
  });

  describe("project isolation", () => {
    it("should separate data by project_id", () => {
      const project2 = sqliteStore.initProject("Other Project");
      const otherProjectId = project2.id;

      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(otherProjectId, "context", 500, 1000);

      const summary1 = tokenStore.getSummary(projectId);
      expect(summary1.totalCalls).toBe(1);
      expect(summary1.perTool[0].toolName).toBe("list");

      const summary2 = tokenStore.getSummary(otherProjectId);
      expect(summary2.totalCalls).toBe(1);
      expect(summary2.perTool[0].toolName).toBe("context");
    });
  });

  describe("clearProject", () => {
    it("should clear all data for a project", () => {
      tokenStore.record(projectId, "list", 100, 200);
      tokenStore.record(projectId, "context", 500, 1000);

      tokenStore.clearProject(projectId);

      const summary = tokenStore.getSummary(projectId);
      expect(summary.totalCalls).toBe(0);
    });
  });
});
