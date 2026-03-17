import { describe, it, expect } from "vitest";
import {
  checkToolGate,
  checkStatusGate,
  detectWarnings,
  type LifecyclePhase,
} from "../core/planner/lifecycle-phase.js";
import { buildLifecycleBlock } from "../mcp/lifecycle-wrapper.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";

// ── Factory ──

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Task ${i}`,
    status: n.status ?? "backlog",
    priority: n.priority ?? 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...n,
  })) as GraphNode[];

  const fullEdges: GraphEdge[] = edges.map((e, i) => ({
    id: e.id ?? `edge_${i}`,
    from: e.from ?? "",
    to: e.to ?? "",
    relationType: e.relationType ?? "depends_on",
    createdAt: "2025-01-01T00:00:00Z",
    ...e,
  })) as GraphEdge[];

  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: fullNodes,
    edges: fullEdges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

// ══════════════════════════════════════════════════════════════════
// 1. checkToolGate — default strict para TODAS as tools restritas
// ══════════════════════════════════════════════════════════════════

describe("checkToolGate default strict — all restricted tools", () => {
  const RESTRICTED_IN_ANALYZE: Array<{ tool: string; phase: LifecyclePhase }> = [
    { tool: "update_status", phase: "ANALYZE" },
    { tool: "bulk_update_status", phase: "ANALYZE" },
    { tool: "plan_sprint", phase: "ANALYZE" },
    { tool: "decompose", phase: "ANALYZE" },
  ];

  const RESTRICTED_MULTI_PHASE: Array<{ tool: string; phase: LifecyclePhase }> = [
    { tool: "validate_task", phase: "ANALYZE" },
    { tool: "validate_task", phase: "DESIGN" },
    { tool: "validate_task", phase: "PLAN" },
    { tool: "velocity", phase: "ANALYZE" },
    { tool: "velocity", phase: "DESIGN" },
  ];

  const ALL_RESTRICTED = [...RESTRICTED_IN_ANALYZE, ...RESTRICTED_MULTI_PHASE];

  it.each(ALL_RESTRICTED)(
    "should return error (not warning) for $tool in $phase without explicit mode",
    ({ tool, phase }) => {
      const doc = makeDoc();
      const warnings = checkToolGate(doc, phase, tool);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe("error");
      expect(warnings[0].code).toBe("tool_phase_blocked");
    },
  );
});

// ══════════════════════════════════════════════════════════════════
// 2. checkToolGate — regressão: advisory explícito ainda funciona
// ══════════════════════════════════════════════════════════════════

describe("checkToolGate advisory opt-in regression", () => {
  const RESTRICTED: Array<{ tool: string; phase: LifecyclePhase }> = [
    { tool: "update_status", phase: "ANALYZE" },
    { tool: "bulk_update_status", phase: "ANALYZE" },
    { tool: "plan_sprint", phase: "ANALYZE" },
    { tool: "validate_task", phase: "DESIGN" },
    { tool: "velocity", phase: "ANALYZE" },
    { tool: "decompose", phase: "ANALYZE" },
  ];

  it.each(RESTRICTED)(
    "should return warning (not error) for $tool in $phase with explicit advisory",
    ({ tool, phase }) => {
      const doc = makeDoc();
      const warnings = checkToolGate(doc, phase, tool, "advisory");

      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe("warning");
      expect(warnings[0].code).toBe("tool_phase_blocked");
    },
  );
});

// ══════════════════════════════════════════════════════════════════
// 3. checkStatusGate — default strict
// ══════════════════════════════════════════════════════════════════

describe("checkStatusGate default strict", () => {
  it("should return error for done_without_acceptance_criteria without explicit mode", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1" },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done");

    const acWarning = result.warnings.find((w) => w.code === "done_without_acceptance_criteria");
    expect(acWarning).toBeDefined();
    expect(acWarning!.severity).toBe("error");
  });

  it("should return error for in_progress_without_sprint without explicit mode", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "backlog", sprint: null },
    ]);
    const result = checkStatusGate(doc, "PLAN", "t1", "in_progress");

    const sprintWarning = result.warnings.find((w) => w.code === "in_progress_without_sprint");
    expect(sprintWarning).toBeDefined();
    expect(sprintWarning!.severity).toBe("error");
  });

  it("should keep done_without_in_progress as warning even with strict default", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "ready", sprint: "s1", acceptanceCriteria: ["check1"] },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done");

    const skipWarning = result.warnings.find((w) => w.code === "done_without_in_progress");
    expect(skipWarning).toBeDefined();
    expect(skipWarning!.severity).toBe("warning");
  });
});

// ══════════════════════════════════════════════════════════════════
// 4. checkStatusGate — regressão: advisory explícito
// ══════════════════════════════════════════════════════════════════

describe("checkStatusGate advisory opt-in regression", () => {
  it("should return warning for done_without_acceptance_criteria with explicit advisory", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1" },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "advisory");

    const acWarning = result.warnings.find((w) => w.code === "done_without_acceptance_criteria");
    expect(acWarning).toBeDefined();
    expect(acWarning!.severity).toBe("warning");
  });

  it("should return warning for in_progress_without_sprint with explicit advisory", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "backlog", sprint: null },
    ]);
    const result = checkStatusGate(doc, "PLAN", "t1", "in_progress", "advisory");

    const sprintWarning = result.warnings.find((w) => w.code === "in_progress_without_sprint");
    expect(sprintWarning).toBeDefined();
    expect(sprintWarning!.severity).toBe("warning");
  });
});

// ══════════════════════════════════════════════════════════════════
// 5. detectWarnings — default strict
// ══════════════════════════════════════════════════════════════════

describe("detectWarnings default strict", () => {
  it("should return tool_phase_blocked as error for restricted tool without mode", () => {
    const doc = makeDoc();
    const warnings = detectWarnings(doc, "ANALYZE", "update_status");

    const blocked = warnings.find((w) => w.code === "tool_phase_blocked");
    expect(blocked).toBeDefined();
    expect(blocked!.severity).toBe("error");
  });

  it("should return premature_status_change as error without mode", () => {
    const doc = makeDoc();
    const warnings = detectWarnings(doc, "ANALYZE", "update_status");

    const premature = warnings.find((w) => w.code === "premature_status_change");
    expect(premature).toBeDefined();
    expect(premature!.severity).toBe("error");
  });

  it("should keep tool_not_recommended as info regardless of strict default", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "export");

    const notRecommended = warnings.find((w) => w.code === "tool_not_recommended");
    expect(notRecommended).toBeDefined();
    expect(notRecommended!.severity).toBe("info");
  });
});

// ══════════════════════════════════════════════════════════════════
// 6. detectWarnings — regressão: advisory explícito
// ══════════════════════════════════════════════════════════════════

describe("detectWarnings advisory opt-in regression", () => {
  it("should return tool_phase_blocked as warning with explicit advisory", () => {
    const doc = makeDoc();
    const warnings = detectWarnings(doc, "ANALYZE", "update_status", "advisory");

    const blocked = warnings.find((w) => w.code === "tool_phase_blocked");
    expect(blocked).toBeDefined();
    expect(blocked!.severity).toBe("warning");
  });

  it("should return premature_status_change as warning with explicit advisory", () => {
    const doc = makeDoc();
    const warnings = detectWarnings(doc, "ANALYZE", "update_status", "advisory");

    const premature = warnings.find((w) => w.code === "premature_status_change");
    expect(premature).toBeDefined();
    expect(premature!.severity).toBe("warning");
  });
});

// ══════════════════════════════════════════════════════════════════
// 7. buildLifecycleBlock — default strict propagation
// ══════════════════════════════════════════════════════════════════

describe("buildLifecycleBlock default strict propagation", () => {
  it("should propagate strict default to tool gate warnings", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { toolName: "update_status" });

    const blocked = block.warnings.find((w) => w.code === "tool_phase_blocked");
    expect(blocked).toBeDefined();
    expect(blocked!.severity).toBe("error");
  });

  it("should propagate strict default to premature_status_change", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { toolName: "update_status" });

    const premature = block.warnings.find((w) => w.code === "premature_status_change");
    expect(premature).toBeDefined();
    expect(premature!.severity).toBe("error");
  });

  it("should use advisory when explicitly passed — no errors in warnings", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { toolName: "update_status", mode: "advisory" });

    const errors = block.warnings.filter((w) => w.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("should return no gate warnings for unrestricted tools regardless of mode", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc, { toolName: "next" });

    expect(block.warnings.filter((w) => w.code === "tool_phase_blocked")).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// 8. Cross-function consistency — all defaults agree
// ══════════════════════════════════════════════════════════════════

describe("cross-function strict default consistency", () => {
  it("checkToolGate, detectWarnings, buildLifecycleBlock should all produce errors by default", () => {
    const doc = makeDoc();

    // checkToolGate
    const gateWarnings = checkToolGate(doc, "ANALYZE", "update_status");
    expect(gateWarnings[0].severity).toBe("error");

    // detectWarnings (includes checkToolGate internally)
    const detectW = detectWarnings(doc, "ANALYZE", "update_status");
    const blocked = detectW.find((w) => w.code === "tool_phase_blocked");
    expect(blocked!.severity).toBe("error");

    // buildLifecycleBlock (uses detectWarnings internally)
    const block = buildLifecycleBlock(doc, { toolName: "update_status" });
    const blockBlocked = block.warnings.find((w) => w.code === "tool_phase_blocked");
    expect(blockBlocked!.severity).toBe("error");
  });

  it("checkStatusGate should agree with checkToolGate on strict default", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1" },
    ]);

    // checkToolGate for a restricted tool
    const gateW = checkToolGate(doc, "ANALYZE", "update_status");
    expect(gateW[0].severity).toBe("error");

    // checkStatusGate for a violation
    const statusDoc = makeDoc([
      { id: "t1", type: "task", status: "backlog", sprint: null },
    ]);
    const statusW = checkStatusGate(statusDoc, "PLAN", "t1", "in_progress");
    const sprintW = statusW.warnings.find((w) => w.code === "in_progress_without_sprint");
    expect(sprintW!.severity).toBe("error");
  });

  it("all functions should produce warnings when advisory is explicitly passed", () => {
    const doc = makeDoc();

    const gateW = checkToolGate(doc, "ANALYZE", "update_status", "advisory");
    expect(gateW[0].severity).toBe("warning");

    const detectW = detectWarnings(doc, "ANALYZE", "update_status", "advisory");
    const blocked = detectW.find((w) => w.code === "tool_phase_blocked");
    expect(blocked!.severity).toBe("warning");

    const block = buildLifecycleBlock(doc, { toolName: "update_status", mode: "advisory" });
    const blockBlocked = block.warnings.find((w) => w.code === "tool_phase_blocked");
    expect(blockBlocked!.severity).toBe("warning");

    const statusDoc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1" },
    ]);
    const statusW = checkStatusGate(statusDoc, "IMPLEMENT", "t1", "done", "advisory");
    const acW = statusW.warnings.find((w) => w.code === "done_without_acceptance_criteria");
    expect(acW!.severity).toBe("warning");
  });
});
