import { describe, it, expect } from "vitest";
import {
  validatePhaseTransition,
  checkToolGate,
  checkStatusGate,
  getPhaseGuidance,
  type LifecyclePhase,
} from "../core/planner/lifecycle-phase.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";

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

// ── validatePhaseTransition ──

describe("validatePhaseTransition", () => {
  it("should block ANALYZE → DESIGN when no epic or requirement exists", () => {
    const doc = makeDoc();
    const result = validatePhaseTransition(doc, "ANALYZE", "DESIGN");
    expect(result.allowed).toBe(false);
    expect(result.unmetConditions.length).toBeGreaterThan(0);
  });

  it("should allow ANALYZE → DESIGN when epic exists", () => {
    const doc = makeDoc([{ type: "epic", status: "backlog" }]);
    const result = validatePhaseTransition(doc, "ANALYZE", "DESIGN");
    expect(result.allowed).toBe(true);
    expect(result.unmetConditions).toHaveLength(0);
  });

  it("should allow ANALYZE → DESIGN when requirement exists", () => {
    const doc = makeDoc([{ type: "requirement", status: "backlog" }]);
    const result = validatePhaseTransition(doc, "ANALYZE", "DESIGN");
    expect(result.allowed).toBe(true);
  });

  it("should block DESIGN → PLAN when no decision or constraint exists", () => {
    const doc = makeDoc([{ type: "epic", status: "backlog" }]);
    const result = validatePhaseTransition(doc, "DESIGN", "PLAN");
    expect(result.allowed).toBe(false);
    expect(result.unmetConditions.length).toBeGreaterThan(0);
  });

  it("should block DESIGN → PLAN when only decision exists (no constraint)", () => {
    const doc = makeDoc([{ type: "decision", status: "backlog" }]);
    const result = validatePhaseTransition(doc, "DESIGN", "PLAN");
    expect(result.allowed).toBe(false);
    expect(result.unmetConditions.some((c) => c.includes("constraint"))).toBe(true);
  });

  it("should block DESIGN → PLAN when only constraint exists (no decision)", () => {
    const doc = makeDoc([{ type: "constraint", status: "backlog" }]);
    const result = validatePhaseTransition(doc, "DESIGN", "PLAN");
    expect(result.allowed).toBe(false);
    expect(result.unmetConditions.some((c) => c.includes("decision"))).toBe(true);
  });

  it("should allow DESIGN → PLAN when all required checks pass", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement", status: "backlog" },
        {
          id: "dec1", type: "decision", status: "backlog",
          description: "## Status\nAccepted\n## Context\nX\n## Decision\nY\n## Consequences\nZ",
        },
        { id: "con1", type: "constraint", status: "backlog" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
      ],
    );
    const result = validatePhaseTransition(doc, "DESIGN", "PLAN");
    expect(result.allowed).toBe(true);
    expect(result.unmetConditions).toHaveLength(0);
  });

  it("should block DESIGN → PLAN when ADR grade is below C", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision", description: "No ADR sections" },
        { id: "con1", type: "constraint" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
      ],
    );
    const result = validatePhaseTransition(doc, "DESIGN", "PLAN");
    expect(result.allowed).toBe(false);
    expect(result.unmetConditions.some((c) => c.includes("ADR"))).toBe(true);
  });

  it("should block DESIGN → PLAN when requirements are orphans", () => {
    const doc = makeDoc([
      { id: "req1", type: "requirement" },
      {
        id: "dec1", type: "decision",
        description: "## Status\nAccepted\n## Context\nX\n## Decision\nY\n## Consequences\nZ",
      },
      { id: "con1", type: "constraint" },
    ]);
    const result = validatePhaseTransition(doc, "DESIGN", "PLAN");
    expect(result.allowed).toBe(false);
    expect(result.unmetConditions.some((c) => c.includes("edge"))).toBe(true);
  });

  it("should block PLAN → IMPLEMENT when no tasks have sprint", () => {
    const doc = makeDoc([
      { type: "task", status: "backlog", sprint: null },
    ]);
    const result = validatePhaseTransition(doc, "PLAN", "IMPLEMENT");
    expect(result.allowed).toBe(false);
  });

  it("should allow PLAN → IMPLEMENT when tasks have sprint", () => {
    const doc = makeDoc([
      { type: "task", status: "ready", sprint: "sprint-1" },
    ]);
    const result = validatePhaseTransition(doc, "PLAN", "IMPLEMENT");
    expect(result.allowed).toBe(true);
  });

  // ── IMPLEMENT → VALIDATE (composite gate) ──

  it("should block IMPLEMENT → VALIDATE when less than 50% done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1", acceptanceCriteria: ["Given X When Y Then Z"] },
      { type: "task", status: "backlog", sprint: "s1" },
      { type: "task", status: "backlog", sprint: "s1" },
    ]);
    const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
    expect(result.allowed).toBe(false);
  });

  it("should block IMPLEMENT → VALIDATE when no acceptance criteria", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1" },
      { type: "task", status: "done", sprint: "s1" },
    ]);
    const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
    expect(result.allowed).toBe(false);
    expect(result.unmetConditions.some((c) => c.toLowerCase().includes("acceptance criteria"))).toBe(true);
  });

  it("should allow IMPLEMENT → VALIDATE when all required checks pass", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1", acceptanceCriteria: ["Given X When Y Then Z"], createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
      { type: "task", status: "backlog", sprint: "s1" },
    ]);
    const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
    expect(result.allowed).toBe(true);
  });

  it("should allow IMPLEMENT → VALIDATE with acceptance_criteria node type", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1", acceptanceCriteria: ["Given X When Y Then Z"], createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
      { type: "task", status: "backlog", sprint: "s1" },
      { type: "acceptance_criteria", status: "backlog" },
    ]);
    const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
    expect(result.allowed).toBe(true);
  });

  it("should block IMPLEMENT → VALIDATE when done task has blocked dependency", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "done", sprint: "s1", acceptanceCriteria: ["Given X When Y Then Z"] },
        { id: "t2", type: "task", status: "backlog", sprint: "s1" },
      ],
      [{ from: "t1", to: "t2", relationType: "depends_on" }],
    );
    const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
    expect(result.allowed).toBe(false);
    expect(result.unmetConditions.some((c) => c.includes("integridade"))).toBe(true);
  });

  it("should include testable AC warning in unmetConditions when done tasks lack testable AC", () => {
    const doc = makeDoc([
      {
        type: "task", status: "done", sprint: "s1",
        acceptanceCriteria: ["Make it nice"],
        createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z",
      },
      { type: "task", status: "backlog", sprint: "s1" },
    ]);
    const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
    // The gate may or may not be allowed (depends on composite checks),
    // but unmetConditions should mention testable AC
    expect(result.unmetConditions.some((c) => c.includes("testável") || c.includes("testable"))).toBe(true);
  });

  it("should not include testable AC warning when done tasks have testable AC", () => {
    const doc = makeDoc([
      {
        type: "task", status: "done", sprint: "s1",
        acceptanceCriteria: ["Given valid input, When submitted, Then should return 200"],
        createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z",
      },
      { type: "task", status: "backlog", sprint: "s1" },
    ]);
    const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
    expect(result.unmetConditions.some((c) => c.includes("testável") || c.includes("testable"))).toBe(false);
  });

  // ── VALIDATE → REVIEW (composite gate) ──

  it("should block VALIDATE → REVIEW when less than 80% done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "backlog", sprint: "s1" },
      { type: "task", status: "backlog", sprint: "s1" },
    ]);
    const result = validatePhaseTransition(doc, "VALIDATE", "REVIEW");
    expect(result.allowed).toBe(false);
  });

  it("should allow VALIDATE → REVIEW when all required checks pass", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "backlog" },
    ]);
    const result = validatePhaseTransition(doc, "VALIDATE", "REVIEW");
    expect(result.allowed).toBe(true);
  });

  // ── REVIEW → HANDOFF (composite gate) ──

  it("should block REVIEW → HANDOFF when not all tasks done", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "in_progress" },
    ]);
    const result = validatePhaseTransition(doc, "REVIEW", "HANDOFF");
    expect(result.allowed).toBe(false);
  });

  it("should allow REVIEW → HANDOFF when all required checks pass", () => {
    const doc = makeDoc([
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
      { type: "task", status: "done", acceptanceCriteria: ["AC1"] },
    ]);
    const result = validatePhaseTransition(doc, "REVIEW", "HANDOFF");
    expect(result.allowed).toBe(true);
  });

  // ── HANDOFF → LISTENING (composite gate) ──

  it("should block HANDOFF → LISTENING when tasks still in_progress", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "in_progress" },
    ]);
    const result = validatePhaseTransition(doc, "HANDOFF", "LISTENING");
    expect(result.allowed).toBe(false);
  });

  it("should allow HANDOFF → LISTENING when all tasks done and no blocked", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "done" },
    ]);
    const result = validatePhaseTransition(doc, "HANDOFF", "LISTENING");
    expect(result.allowed).toBe(true);
  });

  it("should block HANDOFF → LISTENING when tasks are blocked", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "blocked" },
    ]);
    const result = validatePhaseTransition(doc, "HANDOFF", "LISTENING");
    expect(result.allowed).toBe(false);
  });

  it("should allow transitions with no defined gate", () => {
    const doc = makeDoc();
    const result = validatePhaseTransition(doc, "LISTENING", "ANALYZE");
    expect(result.allowed).toBe(true);
  });
});

// ── checkToolGate ──

describe("checkToolGate", () => {
  it("should return empty warnings for always-allowed tools", () => {
    const doc = makeDoc();
    const warnings = checkToolGate(doc, "ANALYZE", "init");
    expect(warnings).toHaveLength(0);
  });

  it("should return empty warnings for always-allowed tools in any phase", () => {
    const alwaysAllowed = ["list", "show", "search", "metrics", "export", "snapshot",
      "add_node", "edge", "import_prd", "context", "rag_context", "next",
      "sync_stack_docs", "reindex_knowledge", "analyze", "set_phase"];
    const doc = makeDoc();
    for (const tool of alwaysAllowed) {
      const warnings = checkToolGate(doc, "ANALYZE", tool);
      expect(warnings).toHaveLength(0);
    }
  });

  it("should return error for update_status in ANALYZE in strict mode", () => {
    const doc = makeDoc();
    const warnings = checkToolGate(doc, "ANALYZE", "update_status", "strict");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("error");
    expect(warnings[0].code).toBe("tool_phase_blocked");
  });

  it("should return warning for update_status in ANALYZE in advisory mode", () => {
    const doc = makeDoc();
    const warnings = checkToolGate(doc, "ANALYZE", "update_status", "advisory");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("warning");
  });

  it("should not block update_status in IMPLEMENT phase", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const warnings = checkToolGate(doc, "IMPLEMENT", "update_status", "strict");
    expect(warnings).toHaveLength(0);
  });

  it("should block validate_task in ANALYZE, DESIGN, PLAN", () => {
    const doc = makeDoc();
    for (const phase of ["ANALYZE", "DESIGN", "PLAN"] as LifecyclePhase[]) {
      const warnings = checkToolGate(doc, phase, "validate_task", "strict");
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe("error");
    }
  });

  it("should allow validate_task in IMPLEMENT and later phases", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress" }]);
    for (const phase of ["IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "LISTENING"] as LifecyclePhase[]) {
      const warnings = checkToolGate(doc, phase, "validate_task", "strict");
      expect(warnings).toHaveLength(0);
    }
  });

  it("should block plan_sprint in ANALYZE", () => {
    const doc = makeDoc();
    const warnings = checkToolGate(doc, "ANALYZE", "plan_sprint", "strict");
    expect(warnings).toHaveLength(1);
  });

  it("should allow tools not in restriction map in any phase", () => {
    const doc = makeDoc();
    const warnings = checkToolGate(doc, "ANALYZE", "update_node", "strict");
    expect(warnings).toHaveLength(0);
  });

  it("should default to strict mode", () => {
    const doc = makeDoc();
    const warnings = checkToolGate(doc, "ANALYZE", "update_status");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("error");
  });
});

// ── checkStatusGate ──

describe("checkStatusGate", () => {
  it("should warn when marking done without AC in IMPLEMENT strict mode", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1" },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "strict");
    expect(result.warnings.some((w) => w.code === "done_without_acceptance_criteria")).toBe(true);
    expect(result.warnings.find((w) => w.code === "done_without_acceptance_criteria")!.severity).toBe("error");
  });

  it("should not warn about AC when node has acceptanceCriteria", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1", acceptanceCriteria: ["check1"] },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "strict");
    expect(result.warnings.some((w) => w.code === "done_without_acceptance_criteria")).toBe(false);
  });

  it("should not warn about AC when parent has acceptanceCriteria", () => {
    const doc = makeDoc([
      { id: "epic1", type: "epic", status: "backlog", acceptanceCriteria: ["check1"] },
      { id: "t1", type: "task", status: "in_progress", parentId: "epic1" },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "strict");
    expect(result.warnings.some((w) => w.code === "done_without_acceptance_criteria")).toBe(false);
  });

  it("should not warn about AC when acceptance_criteria node exists", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1" },
      { id: "ac1", type: "acceptance_criteria", status: "backlog" },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "strict");
    expect(result.warnings.some((w) => w.code === "done_without_acceptance_criteria")).toBe(false);
  });

  it("should warn when starting task without sprint in PLAN", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "backlog", sprint: null },
    ]);
    const result = checkStatusGate(doc, "PLAN", "t1", "in_progress", "strict");
    expect(result.warnings.some((w) => w.code === "in_progress_without_sprint")).toBe(true);
    expect(result.warnings.find((w) => w.code === "in_progress_without_sprint")!.severity).toBe("error");
  });

  it("should not warn about sprint when task has sprint assigned", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "backlog", sprint: "sprint-1" },
    ]);
    const result = checkStatusGate(doc, "PLAN", "t1", "in_progress", "strict");
    expect(result.warnings.some((w) => w.code === "in_progress_without_sprint")).toBe(false);
  });

  it("should warn when marking done without in_progress first", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "ready", sprint: "s1", acceptanceCriteria: ["check1"] },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "advisory");
    expect(result.warnings.some((w) => w.code === "done_without_in_progress")).toBe(true);
    // This one is always "warning" even in strict
    expect(result.warnings.find((w) => w.code === "done_without_in_progress")!.severity).toBe("warning");
  });

  it("should not warn about in_progress skip when node is already in_progress", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1", acceptanceCriteria: ["check1"] },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "advisory");
    expect(result.warnings.some((w) => w.code === "done_without_in_progress")).toBe(false);
  });

  it("should return no warnings when transitioning normally", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1", acceptanceCriteria: ["check1"] },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "strict");
    expect(result.warnings).toHaveLength(0);
  });

  it("should default to strict mode", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1" },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done");
    expect(result.warnings.find((w) => w.code === "done_without_acceptance_criteria")!.severity).toBe("error");
  });

  // ── DoD pre-check ──

  it("should warn done_without_dod when task has unresolved blockers", () => {
    const doc = makeDoc(
      [
        { id: "t1", type: "task", status: "in_progress", acceptanceCriteria: ["Should return 200"] },
        { id: "t2", type: "task", status: "backlog" },
      ],
      [{ from: "t1", to: "t2", relationType: "depends_on" }],
    );
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "strict");
    expect(result.warnings.some((w) => w.code === "done_without_dod")).toBe(true);
    // DoD is always warning severity (informational)
    expect(result.warnings.find((w) => w.code === "done_without_dod")!.severity).toBe("warning");
  });

  it("should not warn done_without_dod when DoD is satisfied", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task", status: "in_progress", xpSize: "S",
        acceptanceCriteria: ["Given valid data, When submitted, Then should save and return 200"],
      },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "strict");
    expect(result.warnings.some((w) => w.code === "done_without_dod")).toBe(false);
  });

  it("should not fire DoD check when node has no AC", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", status: "in_progress", sprint: "s1" },
    ]);
    const result = checkStatusGate(doc, "IMPLEMENT", "t1", "done", "strict");
    // Should have done_without_acceptance_criteria but NOT done_without_dod
    expect(result.warnings.some((w) => w.code === "done_without_acceptance_criteria")).toBe(true);
    expect(result.warnings.some((w) => w.code === "done_without_dod")).toBe(false);
  });
});

// ── getPhaseGuidance ──

describe("getPhaseGuidance", () => {
  it("should include analyze in IMPLEMENT suggestedTools", () => {
    const guidance = getPhaseGuidance("IMPLEMENT");
    expect(guidance.suggestedTools).toContain("analyze");
  });

  it("should include next and context in IMPLEMENT suggestedTools", () => {
    const guidance = getPhaseGuidance("IMPLEMENT");
    expect(guidance.suggestedTools).toContain("next");
    expect(guidance.suggestedTools).toContain("context");
  });
});
