/**
 * E2E Bug Reteste — MCP Tool Handlers
 *
 * Tests the FULL path: MCP tool handler → core logic → SQLite store → JSON response.
 * Covers CRITICAL (#001-#006), HIGH (#010-#018, #023, #025-#026), and MEDIUM bugs.
 *
 * Pattern: register tool on McpServer, call handler directly, parse JSON response.
 * Reference: src/tests/mcp-tools-crud.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerInit } from "../mcp/tools/init.js";
import { registerSetPhase } from "../mcp/tools/set-phase.js";
import { registerNode } from "../mcp/tools/node.js";
import { registerEdge } from "../mcp/tools/edge.js";
import { registerContext } from "../mcp/tools/context.js";
import { registerExport } from "../mcp/tools/export.js";
import { registerAnalyze } from "../mcp/tools/analyze.js";
import { registerMetrics } from "../mcp/tools/metrics.js";
import { registerUpdateStatus } from "../mcp/tools/update-status.js";
import { registerSnapshot } from "../mcp/tools/snapshot.js";
import { registerCloneNode } from "../mcp/tools/clone-node.js";
import { registerReindexKnowledge } from "../mcp/tools/reindex-knowledge.js";
import { registerImportPrd } from "../mcp/tools/import-prd.js";
import { wrapToolsWithCodeIntelligence } from "../mcp/code-intelligence-wrapper.js";
import { makeNode, makeEpic, makeEdge } from "./helpers/factories.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTools = any;

function createServer(): McpServer {
  return new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
}

function tools(server: McpServer): AnyTools {
  return (server as AnyTools)._registeredTools;
}

function parse(result: AnyTools): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════
// GRUPO 1: CRITICAL — Deadlock & Bootstrap (#001, #005, #006)
// ══════════════════════════════════════════════════════════════════

describe("E2E CRITICAL — Deadlock: bootstrap tools in strict mode (#001, #005, #006)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    // Set code_intelligence to strict with EMPTY index
    store.setProjectSetting("code_intelligence_mode", "strict");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("#001: set_phase should NOT be blocked by code_intelligence strict + empty index", async () => {
    registerSetPhase(server, store);
    wrapToolsWithCodeIntelligence(server, store);

    const result = await tools(server)["set_phase"].handler({
      phase: "ANALYZE",
      mode: "advisory",
      codeIntelligence: "off",
    });
    const parsed = parse(result);

    expect(result.isError).toBeFalsy();
    expect(parsed.error).not.toBe("code_intelligence_gate_blocked");
  });

  it("#005: init should NOT be blocked in strict mode", async () => {
    registerInit(server, store);
    wrapToolsWithCodeIntelligence(server, store);

    const result = await tools(server)["init"].handler({ projectName: "Retest" });
    const parsed = parse(result);

    expect(result.isError).toBeFalsy();
    expect(parsed.error).not.toBe("code_intelligence_gate_blocked");
  });

  it("#006: reindex_knowledge should NOT be blocked by empty index", async () => {
    registerReindexKnowledge(server, store);
    wrapToolsWithCodeIntelligence(server, store);

    const result = await tools(server)["reindex_knowledge"].handler({});
    const parsed = parse(result);

    expect(result.isError).toBeFalsy();
    expect(parsed.error).not.toBe("code_intelligence_gate_blocked");
  });

  it("#001: mutating tool auto-downgrades to advisory in strict + empty index", async () => {
    registerNode(server, store);
    wrapToolsWithCodeIntelligence(server, store);

    const result = await tools(server)["node"].handler({
      action: "add",
      title: "Test",
      type: "task",
    });
    const parsed = parse(result);

    // Bug #001/NEW-2 fix: strict + empty index auto-downgrades to advisory (no deadlock)
    expect(parsed.error).not.toBe("code_intelligence_gate_blocked");
  });
});

// ══════════════════════════════════════════════════════════════════
// GRUPO 2: CRITICAL — Security (#003, #004)
// ══════════════════════════════════════════════════════════════════

describe("E2E CRITICAL — Security: path traversal (#003, #004)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("#004: import_prd with /etc/passwd should not succeed", async () => {
    registerImportPrd(server, store);

    // readPrdFile throws Error("Path outside project directory") which
    // may or may not be caught by the handler. Either way, it must NOT succeed.
    let errorThrown = false;
    let resultError = false;
    try {
      const result = await tools(server)["import_prd"].handler({
        filePath: "/etc/passwd",
      });
      resultError = result.isError === true;
    } catch (err) {
      errorThrown = true;
      expect(String(err)).toMatch(/Path outside project directory|Unsupported file extension/);
    }

    expect(errorThrown || resultError).toBe(true);
  });

  it("#004: import_prd with relative traversal should not succeed", async () => {
    registerImportPrd(server, store);

    let errorThrown = false;
    let resultError = false;
    try {
      const result = await tools(server)["import_prd"].handler({
        filePath: "../../../etc/passwd",
      });
      resultError = result.isError === true;
    } catch {
      errorThrown = true;
    }

    expect(errorThrown || resultError).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// GRUPO 3: HIGH — Input Validation (#016, #018, #032, #033, #046)
// ══════════════════════════════════════════════════════════════════

describe("E2E HIGH — Input Validation via MCP handlers", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("#016: node(add) with estimateMinutes=-10 should not succeed", async () => {
    registerNode(server, store);

    // In production, Zod rejects before handler. In direct handler call,
    // store.insertNode() validates via GraphNodeSchema and throws ValidationError.
    let errorThrown = false;
    let resultOk = false;
    try {
      const result = await tools(server)["node"].handler({
        action: "add",
        title: "Bad estimate",
        type: "task",
        estimateMinutes: -10,
      });
      const parsed = parse(result);
      resultOk = parsed.ok === true;
    } catch {
      errorThrown = true;
    }

    // Either the handler threw OR it returned an error response — NOT ok:true
    expect(errorThrown || !resultOk).toBe(true);
  });

  it("#018: edge(add) with weight=-1 should not succeed", async () => {
    registerNode(server, store);
    registerEdge(server, store);

    const r1 = await tools(server)["node"].handler({ action: "add", title: "N1", type: "task" });
    const r2 = await tools(server)["node"].handler({ action: "add", title: "N2", type: "task" });
    const n1 = (parse(r1).node as Record<string, unknown>).id as string;
    const n2 = (parse(r2).node as Record<string, unknown>).id as string;

    // In production, Zod rejects weight=-1 (.min(0).max(1) in tool schema).
    // In direct call, store validates via GraphEdgeSchema and throws.
    let errorThrown = false;
    let resultOk = false;
    try {
      const result = await tools(server)["edge"].handler({
        action: "add",
        from: n1,
        to: n2,
        relationType: "depends_on",
        weight: -1,
      });
      const parsed = parse(result);
      resultOk = parsed.ok === true;
    } catch {
      errorThrown = true;
    }

    expect(errorThrown || !resultOk).toBe(true);

    // Verify no edge was created with invalid weight
    const edges = store.getEdgesFrom(n1);
    const badEdge = edges.find((e) => e.weight !== undefined && (e.weight < 0 || e.weight > 1));
    expect(badEdge).toBeUndefined();
  });

  it("#046: update_status with nonexistent node should return error", async () => {
    registerUpdateStatus(server, store);

    const result = await tools(server)["update_status"].handler({
      id: "nonexistent-node-id",
      status: "done",
    });

    expect(result.isError).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// GRUPO 4: HIGH — Gate Checks (#010, #011, #012)
// ══════════════════════════════════════════════════════════════════

describe("E2E HIGH — Phantom blockers in gate checks (#010, #011, #012)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();

    // Create graph with depends_on edge but NO status=blocked
    const t1 = makeNode({ title: "Task Done", status: "done" });
    const t2 = makeNode({ title: "Task Done 2", status: "done" });
    const edge = makeEdge(t1.id, t2.id, { relationType: "depends_on" });
    store.insertNode(t1);
    store.insertNode(t2);
    store.insertEdge(edge);

    registerAnalyze(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("#010: review_ready should NOT report phantom blocked tasks", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "review_ready" });
    const parsed = parse(result);

    expect(parsed.ok).toBe(true);
    const checks = parsed.checks as Array<{ name: string; passed: boolean; details: string }>;
    const blockedCheck = checks.find((c) => c.name === "no_blocked_tasks");

    expect(blockedCheck).toBeDefined();
    expect(blockedCheck!.passed).toBe(true);
  });

  it("#011: handoff_ready should NOT report phantom blocked nodes", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "handoff_ready" });
    const parsed = parse(result);

    expect(parsed.ok).toBe(true);
    const checks = parsed.checks as Array<{ name: string; passed: boolean }>;
    const blockedCheck = checks.find((c) => c.name === "no_blocked_nodes");

    expect(blockedCheck).toBeDefined();
    expect(blockedCheck!.passed).toBe(true);
  });

  it("#012: listening_ready should NOT report phantom blocked tasks", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "listening_ready" });
    const parsed = parse(result);

    expect(parsed.ok).toBe(true);
    const checks = parsed.checks as Array<{ name: string; passed: boolean }>;
    const blockedCheck = checks.find((c) => c.name === "no_blocked");

    expect(blockedCheck).toBeDefined();
    expect(blockedCheck!.passed).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// GRUPO 5: HIGH — Data Integrity (#023, #025, #026)
// ══════════════════════════════════════════════════════════════════

describe("E2E HIGH — Data integrity (#023, #025, #026)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("#023: export JSON with filterType should rebuild indexes", async () => {
    registerNode(server, store);
    registerExport(server, store);

    // Create mixed nodes
    const epic = makeEpic({ title: "My Epic" });
    const task = makeNode({ title: "My Task", type: "task" });
    store.insertNode(epic);
    store.insertNode(task);

    const result = await tools(server)["export"].handler({
      action: "json",
      filterType: ["epic"],
    });
    const parsed = parse(result);

    // indexes.byId should only contain the epic
    const byId = parsed.indexes as Record<string, unknown>;
    const byIdKeys = Object.keys((byId as Record<string, unknown>).byId as Record<string, unknown>);
    expect(byIdKeys).toContain(epic.id);
    expect(byIdKeys).not.toContain(task.id);
  });

  it("#025: analyze(blockers) with nonexistent nodeId should return error", async () => {
    registerAnalyze(server, store);

    const result = await tools(server)["analyze"].handler({
      mode: "blockers",
      nodeId: "nonexistent-id",
    });

    expect(result.isError).toBe(true);
    const parsed = parse(result);
    expect(JSON.stringify(parsed)).toContain("Node not found");
  });

  it("#026: analyze(implement_done) with nonexistent nodeId should return error", async () => {
    registerAnalyze(server, store);

    const result = await tools(server)["analyze"].handler({
      mode: "implement_done",
      nodeId: "nonexistent-id",
    });

    expect(result.isError).toBe(true);
    const parsed = parse(result);
    expect(JSON.stringify(parsed)).toContain("Node not found");
  });
});

// ══════════════════════════════════════════════════════════════════
// GRUPO 6: MEDIUM — Workflow (#034, #039, #046, #076)
// ══════════════════════════════════════════════════════════════════

describe("E2E MEDIUM — Workflow fixes (#034, #039, #076)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("#034: context reductionPercent should be negative for minimal node (expansion)", async () => {
    registerContext(server, store);

    const node = makeNode({ title: "X" });
    store.insertNode(node);

    const result = await tools(server)["context"].handler({ id: node.id });
    const parsed = parse(result);

    // Response has metrics with reductionPercent
    const metrics = (parsed.node ?? parsed.task) as Record<string, unknown> | undefined;
    const outerMetrics = parsed.metrics as Record<string, unknown> | undefined;
    const reductionPercent = outerMetrics?.reductionPercent ?? (metrics as Record<string, unknown>)?.reductionPercent;

    // Bug #034 fix: negative values indicate expansion, not clamped to 0
    if (reductionPercent !== undefined) {
      expect(reductionPercent as number).toBeLessThan(0);
    }
  });

  it("#039: metrics velocity with nonexistent sprint should return warning", async () => {
    registerMetrics(server, store);

    const result = await tools(server)["metrics"].handler({
      mode: "velocity",
      sprint: "nonexistent-sprint-xyz",
    });
    const parsed = parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.warning).toBeDefined();
    expect(parsed.warning as string).toContain("No sprint matching");
  });

  it("#076: snapshot restore with snapshotId=-1 should not succeed", async () => {
    registerSnapshot(server, store);

    // In production, Zod rejects (.int().min(1)). In direct call,
    // store.restoreSnapshot(-1) throws SnapshotNotFoundError.
    let errorThrown = false;
    let resultError = false;
    try {
      const result = await tools(server)["snapshot"].handler({
        action: "restore",
        snapshotId: -1,
      });
      resultError = result.isError === true;
    } catch {
      errorThrown = true;
    }

    expect(errorThrown || resultError).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// GRUPO 7: MEDIUM — Self-parenting & Edge (#036, #037, #045)
// ══════════════════════════════════════════════════════════════════

describe("E2E MEDIUM — Structural integrity (#036, #037, #045)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
  });

  afterEach(() => {
    store.close();
  });

  it("#036: clone_node with self as parent should return error", async () => {
    registerCloneNode(server, store);

    const node = makeNode({ title: "Self-ref test" });
    store.insertNode(node);

    const result = await tools(server)["clone_node"].handler({
      id: node.id,
      newParentId: node.id,
    });

    expect(result.isError).toBe(true);
    const parsed = parse(result);
    expect(JSON.stringify(parsed)).toContain("own parent");
  });

  it("#037: edge(list) with direction but no nodeId should return error", async () => {
    registerEdge(server, store);

    const result = await tools(server)["edge"].handler({
      action: "list",
      direction: "from",
    });

    expect(result.isError).toBe(true);
    const parsed = parse(result);
    expect(JSON.stringify(parsed)).toContain("direction requires nodeId");
  });

  it("#045: duplicate edge creation should not create duplicate", async () => {
    registerNode(server, store);
    registerEdge(server, store);

    // Create two nodes
    const r1 = await tools(server)["node"].handler({ action: "add", title: "A", type: "task" });
    const r2 = await tools(server)["node"].handler({ action: "add", title: "B", type: "task" });
    const n1 = (parse(r1).node as Record<string, unknown>).id as string;
    const n2 = (parse(r2).node as Record<string, unknown>).id as string;

    // Create edge
    const e1 = await tools(server)["edge"].handler({
      action: "add", from: n1, to: n2, relationType: "depends_on",
    });
    expect(parse(e1).ok).toBe(true);

    // Try to create same edge again
    const e2 = await tools(server)["edge"].handler({
      action: "add", from: n1, to: n2, relationType: "depends_on",
    });
    const parsed = parse(e2);

    // Should indicate existing edge, not create duplicate
    expect(parsed.existing ?? parsed.duplicate ?? parsed.ok).toBeTruthy();

    // Verify only 1 edge exists
    const edgesFrom = store.getEdgesFrom(n1);
    const dependsOnEdges = edgesFrom.filter((e) => e.to === n2 && e.relationType === "depends_on");
    expect(dependsOnEdges).toHaveLength(1);
  });
});
