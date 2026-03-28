/**
 * TDD tests for remaining bug fixes from v5.19.1 retesting.
 * Covers: #001/#002 (cache invalidation), #031 (decompose empty epics),
 * #034 (reductionPercent negative), #035 (node alias), #063 (search wildcard),
 * #079 (detail/tier), #027 (vacuous pass), #009 (traceability warning), NEW-1 (migration 17).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { buildTaskContext } from "../core/context/compact-context.js";
import { detectLargeTasks } from "../core/planner/decompose.js";
import { assembleContext } from "../core/context/context-assembler.js";
import { checkReviewReadiness } from "../core/reviewer/review-readiness.js";
import { buildTraceabilityMatrix } from "../core/designer/traceability-matrix.js";
import { wrapToolsWithCodeIntelligence } from "../mcp/code-intelligence-wrapper.js";
import { makeNode, makeEpic } from "./helpers/factories.js";
import type { GraphNode, GraphDocument } from "../core/graph/graph-types.js";

// ── Helpers ─────────────────────────────────────────────

function createStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("test-project");
  return store;
}

function makeDoc(nodes: GraphNode[]): GraphDocument {
  return {
    version: "1.0",
    project: { id: "test", name: "test", createdAt: "", updatedAt: "" },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

type RegisteredTool = { handler: (...args: unknown[]) => Promise<unknown>; enabled: boolean };

function createMockServer(tools: Record<string, RegisteredTool>): unknown {
  return { _registeredTools: tools };
}

// ── #001/#002: Code Intelligence cache invalidation after set_phase ──

describe("Bug #001/#002 — cache invalidation after set_phase", () => {
  it("should use updated mode after set_phase changes codeIntelligence", async () => {
    const store = createStore();
    // Start with strict mode
    store.setProjectSetting("code_intelligence_mode", "strict");

    // Simulate set_phase handler that changes mode to "off"
    const setPhaseHandler = async () => {
      store.setProjectSetting("code_intelligence_mode", "off");
      return { content: [{ type: "text", text: '{"ok":true}' }] };
    };

    // A mutating tool handler
    const mutatingHandler = async () => {
      return { content: [{ type: "text", text: '{"ok":true}' }] };
    };

    const server = createMockServer({
      set_phase: { handler: setPhaseHandler, enabled: true },
      update_status: { handler: mutatingHandler, enabled: true },
    });

    wrapToolsWithCodeIntelligence(server as never, store);

    const tools = (server as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;

    // Call set_phase which internally changes mode to "off"
    await tools.set_phase.handler({});

    // Next tool call should use "off" mode (not stale "strict")
    const result = await tools.update_status.handler({}) as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };

    // Should NOT be blocked — mode should be "off" now
    expect(result.isError).toBeUndefined();
  });

  it("should auto-downgrade to advisory after set_phase changes to strict with empty index", async () => {
    const store = createStore();
    store.setProjectSetting("code_intelligence_mode", "off");

    // set_phase handler changes mode to "strict"
    const setPhaseHandler = async () => {
      store.setProjectSetting("code_intelligence_mode", "strict");
      return { content: [{ type: "text", text: '{"ok":true}' }] };
    };

    const mutatingHandler = async () => {
      return { content: [{ type: "text", text: '{"ok":true}' }] };
    };

    const server = createMockServer({
      set_phase: { handler: setPhaseHandler, enabled: true },
      update_status: { handler: mutatingHandler, enabled: true },
    });

    wrapToolsWithCodeIntelligence(server as never, store);
    const tools = (server as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;

    // Start in "off" mode — mutating tool should work
    const resultBefore = await tools.update_status.handler({}) as { isError?: boolean };
    expect(resultBefore.isError).toBeUndefined();

    // Switch to strict
    await tools.set_phase.handler({});

    // Bug #001/NEW-2: strict + empty index auto-downgrades to advisory (no deadlock)
    const resultAfter = await tools.update_status.handler({}) as { isError?: boolean };
    expect(resultAfter.isError).toBeUndefined();
  });
});

// ── #031: analyze(decompose) empty epics ──

describe("Bug #031 — decompose detects empty epics", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = createStore();
  });

  afterEach(() => {
    store.close();
  });

  it("should detect epic without children for decomposition", () => {
    const epic = makeEpic({ title: "Empty Epic" });
    store.insertNode(epic);

    const doc = store.toGraphDocument();
    const results = detectLargeTasks(doc);

    expect(results).toHaveLength(1);
    expect(results[0].node.id).toBe(epic.id);
    expect(results[0].reasons.some((r) => r.includes("without children"))).toBe(true);
  });

  it("should NOT detect epic that already has children", () => {
    const epic = makeEpic({ title: "Parent Epic" });
    const child = makeNode({ title: "Child Task", parentId: epic.id });
    store.insertNode(epic);
    store.insertNode(child);

    const doc = store.toGraphDocument();
    const results = detectLargeTasks(doc);

    // Epic has children and no size threshold triggers — should not be detected
    expect(results.find((r) => r.node.id === epic.id)).toBeUndefined();
  });

  it("should NOT detect epic without children if status is done", () => {
    const epic = makeEpic({ title: "Done Epic", status: "done" });
    store.insertNode(epic);

    const doc = store.toGraphDocument();
    const results = detectLargeTasks(doc);

    expect(results).toHaveLength(0);
  });

  it("should NOT detect task without children (only epics)", () => {
    const task = makeNode({ title: "Standalone Task" });
    store.insertNode(task);

    const doc = store.toGraphDocument();
    const results = detectLargeTasks(doc);

    expect(results).toHaveLength(0);
  });
});

// ── #034: context reductionPercent allows negative ──

describe("Bug #034 — reductionPercent allows negative values", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = createStore();
  });

  afterEach(() => {
    store.close();
  });

  it("should produce negative reductionPercent for minimal nodes", () => {
    const node = makeNode({ title: "A" });
    store.insertNode(node);

    const ctx = buildTaskContext(store, node.id);
    expect(ctx).not.toBeNull();
    // JSON overhead exceeds minimal raw text → negative reduction
    expect(ctx!.metrics.reductionPercent).toBeLessThan(0);
  });
});

// ── #035: context node alias ──

describe("Bug #035 — context includes node alias", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = createStore();
  });

  afterEach(() => {
    store.close();
  });

  it("should have node field identical to task field", () => {
    const task = makeNode({ title: "Test Task" });
    store.insertNode(task);

    const ctx = buildTaskContext(store, task.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.node).toBeDefined();
    expect(ctx!.node.id).toBe(ctx!.task.id);
    expect(ctx!.node.title).toBe(ctx!.task.title);
  });

  it("should have node field for epic type too", () => {
    const epic = makeEpic({ title: "Test Epic" });
    store.insertNode(epic);

    const ctx = buildTaskContext(store, epic.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.node).toBeDefined();
    expect(ctx!.node.type).toBe("epic");
    expect(ctx!.task.type).toBe("epic");
  });
});

// ── #079: rag_context detail/tier consistency ──

describe("Bug #079 — assembleContext includes detail alias", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = createStore();
  });

  afterEach(() => {
    store.close();
  });

  it("should have both tier and detail fields with same value", () => {
    const node = makeNode({ title: "Test Task" });
    store.insertNode(node);

    const result = assembleContext(store, "test", { tier: "summary" });
    expect(result.tier).toBe("summary");
    expect(result.detail).toBe("summary");
  });

  it("should default both to standard", () => {
    const result = assembleContext(store, "test");
    expect(result.tier).toBe("standard");
    expect(result.detail).toBe("standard");
  });
});

// ── #027: review_ready ac_coverage vacuous pass ──

describe("Bug #027 — review_ready vacuous pass with 0 done tasks", () => {
  it("should pass ac_coverage when no done tasks exist", () => {
    const t1 = makeNode({ title: "Task 1", status: "in_progress" });
    const t2 = makeNode({ title: "Task 2", status: "ready" });
    const doc = makeDoc([t1, t2]);

    const result = checkReviewReadiness(doc);
    const acCheck = result.checks.find((c) => c.name === "ac_coverage");

    expect(acCheck).toBeDefined();
    expect(acCheck!.passed).toBe(true);
    expect(acCheck!.details).toContain("vacuous");
  });

  it("should fail ac_coverage when done tasks lack AC", () => {
    const t1 = makeNode({ title: "Done Task", status: "done" });
    const doc = makeDoc([t1]);

    const result = checkReviewReadiness(doc);
    const acCheck = result.checks.find((c) => c.name === "ac_coverage");

    expect(acCheck).toBeDefined();
    expect(acCheck!.passed).toBe(false);
    expect(acCheck!.details).toContain("0%");
  });
});

// ── #009: traceability warning when no requirements ──

describe("Bug #009 — traceability warning for missing requirements", () => {
  it("should include warning when graph has nodes but no requirements", () => {
    const t1 = makeNode({ title: "Task 1" });
    const t2 = makeNode({ title: "Task 2" });
    const doc = makeDoc([t1, t2]);

    const report = buildTraceabilityMatrix(doc);
    expect(report.warning).toBeDefined();
    expect(report.warning).toContain("No requirement nodes");
  });

  it("should NOT include warning when requirements exist", () => {
    const req = makeNode({ type: "requirement", title: "Requirement 1" });
    const doc = makeDoc([req]);

    const report = buildTraceabilityMatrix(doc);
    expect(report.warning).toBeUndefined();
  });

  it("should NOT include warning when graph is empty", () => {
    const doc = makeDoc([]);

    const report = buildTraceabilityMatrix(doc);
    expect(report.warning).toBeUndefined();
  });
});

// ── NEW-1: migration 17 cleanup ──

describe("NEW-1 — migration 17 cleans up duplicate project_settings", () => {
  it("should run migration 17 without error on fresh DB", () => {
    const store = createStore();
    // Migration 17 runs as part of store initialization
    const migrations = store.getDb()
      .prepare("SELECT version FROM _migrations ORDER BY version")
      .all() as Array<{ version: number }>;

    expect(migrations.some((m) => m.version === 17)).toBe(true);
    store.close();
  });
});
