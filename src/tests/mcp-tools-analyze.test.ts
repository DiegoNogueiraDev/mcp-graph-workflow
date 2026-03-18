/**
 * Tests for MCP analyze/validate/plan/phase/skills tool handlers.
 * Registers each tool on McpServer and invokes the handler directly.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAnalyze } from "../mcp/tools/analyze.js";
import { registerValidateAc } from "../mcp/tools/validate-ac.js";
import { registerPlanSprint } from "../mcp/tools/plan-sprint.js";
import { registerSetPhase } from "../mcp/tools/set-phase.js";
import { registerListSkills } from "../mcp/tools/list-skills.js";
import { makeNode } from "./helpers/factories.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTools = any;

function createServer(): McpServer {
  return new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
}

function tools(server: McpServer): AnyTools {
  return (server as AnyTools)._registeredTools;
}

function parseResult(result: { content: { type: string; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

// ── analyze tool ──────────────────────────────────────────────

describe("MCP analyze tool", () => {
  let store: SqliteStore;
  let server: McpServer;
  let nodeId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerAnalyze(server, store);

    const node = makeNode({ title: "Task A", status: "backlog" });
    store.insertNode(node);
    nodeId = node.id;
  });

  afterEach(() => {
    store.close();
  });

  it("should analyze prd_quality", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "prd_quality" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("prd_quality");
  });

  it("should analyze scope", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "scope" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("scope");
  });

  it("should analyze ready", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "ready" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("ready");
  });

  it("should analyze risk", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "risk" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("risk");
  });

  it("should analyze blockers with nodeId", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "blockers", nodeId });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("blockers");
    expect(parsed.nodeId).toBe(nodeId);
  });

  it("should return error for blockers without nodeId", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "blockers" });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toBeDefined();
  });

  it("should analyze cycles", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "cycles" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("cycles");
  });

  it("should analyze critical_path", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "critical_path" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("critical_path");
  });

  it("should analyze decompose", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "decompose" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("decompose");
  });

  it("should analyze adr", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "adr" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("adr");
  });

  it("should analyze traceability", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "traceability" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("traceability");
  });

  it("should analyze coupling", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "coupling" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("coupling");
  });

  it("should analyze interfaces", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "interfaces" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("interfaces");
  });

  it("should analyze tech_risk", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "tech_risk" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("tech_risk");
  });

  it("should analyze design_ready", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "design_ready" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("design_ready");
  });

  it("should analyze implement_done with nodeId", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "implement_done", nodeId });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("implement_done");
  });

  it("should return error for implement_done without nodeId", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "implement_done" });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toBeDefined();
  });

  it("should analyze tdd_check", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "tdd_check" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("tdd_check");
  });

  it("should analyze progress", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "progress" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("progress");
  });

  it("should analyze validate_ready", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "validate_ready" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("validate_ready");
  });

  it("should analyze done_integrity", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "done_integrity" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("done_integrity");
  });

  it("should analyze status_flow", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "status_flow" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("status_flow");
  });

  it("should analyze review_ready", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "review_ready" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("review_ready");
  });

  it("should analyze handoff_ready", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "handoff_ready" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("handoff_ready");
  });

  it("should analyze doc_completeness", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "doc_completeness" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("doc_completeness");
  });

  it("should analyze listening_ready", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "listening_ready" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("listening_ready");
  });

  it("should analyze backlog_health", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "backlog_health" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("backlog_health");
  });
});

// ── validate_ac tool ──────────────────────────────────────────

describe("MCP validate_ac tool", () => {
  let store: SqliteStore;
  let server: McpServer;
  let nodeId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerValidateAc(server, store);

    const node = makeNode({
      title: "Task with AC",
      acceptanceCriteria: ["Given a user, When they login, Then they see the dashboard"],
    });
    store.insertNode(node);
    nodeId = node.id;
  });

  afterEach(() => {
    store.close();
  });

  it("should validate all nodes", async () => {
    const result = await tools(server)["validate_ac"].handler({ all: true });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });

  it("should validate a specific node", async () => {
    const result = await tools(server)["validate_ac"].handler({ nodeId });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });
});

// ── plan_sprint tool ──────────────────────────────────────────

describe("MCP plan_sprint tool", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerPlanSprint(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should generate report in default mode", async () => {
    store.insertNode(makeNode({ title: "Sprint task", status: "backlog" }));
    const result = await tools(server)["plan_sprint"].handler({});
    const parsed = parseResult(result);
    expect(parsed).toBeDefined();
  });

  it("should return next task when tasks exist", async () => {
    store.insertNode(makeNode({ title: "Next task", status: "backlog" }));
    const result = await tools(server)["plan_sprint"].handler({ mode: "next" });
    const parsed = parseResult(result);
    expect(parsed.task).toBeDefined();
  });

  it("should return no tasks message when graph is empty", async () => {
    const result = await tools(server)["plan_sprint"].handler({ mode: "next" });
    const parsed = parseResult(result);
    expect(parsed.message).toBe("No tasks available");
  });
});

// ── set_phase tool ──────────────────────────────────────────

describe("MCP set_phase tool", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerSetPhase(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should reset to auto detection", async () => {
    const result = await tools(server)["set_phase"].handler({ phase: "auto" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("reset_to_auto");
    expect(parsed.detectedPhase).toBeDefined();
  });

  it("should set phase to IMPLEMENT with force", async () => {
    const result = await tools(server)["set_phase"].handler({ phase: "IMPLEMENT", force: true });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("override");
    expect(parsed.phase).toBe("IMPLEMENT");
  });

  it("should set mode to advisory", async () => {
    const result = await tools(server)["set_phase"].handler({ phase: "auto", mode: "advisory" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("advisory");
  });
});

// ── list_skills tool ──────────────────────────────────────────

describe("MCP list_skills tool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
    registerListSkills(server);
  });

  it("should list all skills", async () => {
    const result = await tools(server)["list_skills"].handler({});
    const parsed = parseResult(result);
    expect(parsed.total).toBeGreaterThan(0);
    expect(Array.isArray(parsed.skills)).toBe(true);
  });

  it("should filter skills by phase", async () => {
    const result = await tools(server)["list_skills"].handler({ phase: "IMPLEMENT" });
    const parsed = parseResult(result);
    expect(parsed.phase).toBe("IMPLEMENT");
    expect(Array.isArray(parsed.skills)).toBe(true);
  });

  it("should get a specific skill by name", async () => {
    // First list to get a valid name
    const listResult = await tools(server)["list_skills"].handler({});
    const listParsed = parseResult(listResult);
    const skills = listParsed.skills as Array<{ name: string }>;
    const firstName = skills[0].name;

    const result = await tools(server)["list_skills"].handler({ name: firstName });
    const parsed = parseResult(result);
    expect(parsed.name).toBe(firstName);
    expect(parsed.instructions).toBeDefined();
  });

  it("should return error for unknown skill name", async () => {
    const result = await tools(server)["list_skills"].handler({ name: "nonexistent_skill_xyz" });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toBeDefined();
  });
});
