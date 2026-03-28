import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ToolCallLog } from "../core/store/tool-call-log.js";
import { runMigrations, configureDb } from "../core/store/migrations.js";

describe("ToolCallLog", () => {
  let db: Database.Database;
  let log: ToolCallLog;
  const projectId = "proj-1";

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    log = new ToolCallLog(db);
  });

  describe("record", () => {
    it("should record a tool call with nodeId", () => {
      log.record(projectId, "node-1", "context", undefined);
      const calls = log.getCallsForNode(projectId, "node-1");
      expect(calls).toHaveLength(1);
      expect(calls[0].toolName).toBe("context");
      expect(calls[0].nodeId).toBe("node-1");
      expect(calls[0].projectId).toBe(projectId);
    });

    it("should record a project-scoped tool call with null nodeId", () => {
      log.record(projectId, null, "next", undefined);
      expect(log.hasBeenCalled(projectId, null, "next")).toBe(true);
    });

    it("should record tool args as JSON", () => {
      log.record(projectId, "node-1", "analyze", '{"mode":"implement_done"}');
      const calls = log.getCallsForNode(projectId, "node-1");
      expect(calls[0].toolArgs).toBe('{"mode":"implement_done"}');
    });
  });

  describe("hasBeenCalled", () => {
    it("should return true when tool was called for node", () => {
      log.record(projectId, "node-1", "context", undefined);
      expect(log.hasBeenCalled(projectId, "node-1", "context")).toBe(true);
    });

    it("should return false when tool was NOT called for node", () => {
      expect(log.hasBeenCalled(projectId, "node-1", "context")).toBe(false);
    });

    it("should return false when tool was called for different node", () => {
      log.record(projectId, "node-2", "context", undefined);
      expect(log.hasBeenCalled(projectId, "node-1", "context")).toBe(false);
    });

    it("should return true for project-scoped check (null nodeId)", () => {
      log.record(projectId, null, "next", undefined);
      expect(log.hasBeenCalled(projectId, null, "next")).toBe(true);
    });

    it("should match tool args with partial LIKE when args provided", () => {
      log.record(projectId, "node-1", "analyze", '{"mode":"implement_done"}');
      expect(log.hasBeenCalled(projectId, "node-1", "analyze", "implement_done")).toBe(true);
    });

    it("should NOT match when args do not contain the search string", () => {
      log.record(projectId, "node-1", "analyze", '{"mode":"prd_quality"}');
      expect(log.hasBeenCalled(projectId, "node-1", "analyze", "implement_done")).toBe(false);
    });

    it("should match tool without args filter even when args were recorded", () => {
      log.record(projectId, "node-1", "analyze", '{"mode":"implement_done"}');
      expect(log.hasBeenCalled(projectId, "node-1", "analyze")).toBe(true);
    });

    it("should isolate by project", () => {
      log.record("proj-other", "node-1", "context", undefined);
      expect(log.hasBeenCalled(projectId, "node-1", "context")).toBe(false);
    });
  });

  describe("getCallsForNode", () => {
    it("should return all tool calls for a node", () => {
      log.record(projectId, "node-1", "context", undefined);
      log.record(projectId, "node-1", "rag_context", undefined);
      log.record(projectId, "node-2", "context", undefined);

      const calls = log.getCallsForNode(projectId, "node-1");
      expect(calls).toHaveLength(2);
      expect(calls.map((c) => c.toolName).sort()).toEqual(["context", "rag_context"]);
    });

    it("should return empty array when no calls exist", () => {
      expect(log.getCallsForNode(projectId, "node-1")).toEqual([]);
    });
  });

  describe("clearProject", () => {
    it("should remove all calls for the project", () => {
      log.record(projectId, "node-1", "context", undefined);
      log.record(projectId, null, "next", undefined);
      log.clearProject(projectId);

      expect(log.hasBeenCalled(projectId, "node-1", "context")).toBe(false);
      expect(log.hasBeenCalled(projectId, null, "next")).toBe(false);
    });

    it("should not affect other projects", () => {
      log.record(projectId, "node-1", "context", undefined);
      log.record("proj-other", "node-1", "context", undefined);
      log.clearProject(projectId);

      expect(log.hasBeenCalled("proj-other", "node-1", "context")).toBe(true);
    });
  });
});
