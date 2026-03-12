import { describe, it, expect } from "vitest";
import { detectCurrentPhase, getPhaseGuidance, type LifecyclePhase } from "../core/planner/lifecycle-phase.js";
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

describe("detectCurrentPhase", () => {
  it("should return ANALYZE when no nodes exist", () => {
    const doc = makeDoc();
    expect(detectCurrentPhase(doc)).toBe("ANALYZE");
  });

  it("should return DESIGN when only requirement/decision/epic nodes exist without tasks", () => {
    const doc = makeDoc([
      { type: "requirement", status: "backlog" },
      { type: "epic", status: "backlog" },
      { type: "decision", status: "backlog" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("DESIGN");
  });

  it("should return PLAN when tasks exist but none have sprint assigned", () => {
    const doc = makeDoc([
      { type: "epic", status: "backlog" },
      { type: "task", status: "backlog", sprint: null },
      { type: "task", status: "ready", sprint: null },
    ]);
    expect(detectCurrentPhase(doc)).toBe("PLAN");
  });

  it("should return IMPLEMENT when tasks are in_progress", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress", sprint: "sprint-1" },
      { type: "task", status: "backlog", sprint: "sprint-1" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("IMPLEMENT");
  });

  it("should return VALIDATE when most tasks are done but some not validated", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "sprint-1" },
      { type: "task", status: "done", sprint: "sprint-1" },
      { type: "task", status: "ready", sprint: "sprint-1" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("VALIDATE");
  });

  it("should return REVIEW when all tasks are done", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "subtask", status: "done" },
      { type: "epic", status: "done" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("REVIEW");
  });

  it("should return IMPLEMENT when mix of in_progress and done", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress" },
      { type: "task", status: "done" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("IMPLEMENT");
  });

  it("should return DESIGN when acceptance_criteria nodes exist without tasks", () => {
    const doc = makeDoc([
      { type: "requirement", status: "backlog" },
      { type: "acceptance_criteria", status: "backlog" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("DESIGN");
  });

  it("should return IMPLEMENT (not DESIGN) when both design and in_progress task nodes exist", () => {
    const doc = makeDoc([
      { type: "requirement", status: "backlog" },
      { type: "task", status: "in_progress", sprint: "sprint-1" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("IMPLEMENT");
  });

  it("should handle blocked tasks as non-done for VALIDATE threshold", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1" },
      { type: "task", status: "done", sprint: "s1" },
      { type: "task", status: "blocked", sprint: "s1" },
    ]);
    // 2/3 done = 66% → VALIDATE
    expect(detectCurrentPhase(doc)).toBe("VALIDATE");
  });

  it("should return override phase when phaseOverride is provided", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress" },
    ]);
    expect(detectCurrentPhase(doc, { phaseOverride: "LISTENING" })).toBe("LISTENING");
  });

  it("should ignore null phaseOverride and use auto-detection", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress" },
    ]);
    expect(detectCurrentPhase(doc, { phaseOverride: null })).toBe("IMPLEMENT");
  });

  it("should return HANDOFF when all tasks done and snapshots exist", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "done" },
    ]);
    expect(detectCurrentPhase(doc, { hasSnapshots: true })).toBe("HANDOFF");
  });

  it("should return REVIEW (not HANDOFF) when all tasks done but no snapshots", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
    ]);
    expect(detectCurrentPhase(doc, { hasSnapshots: false })).toBe("REVIEW");
  });

  it("should return LISTENING when all tasks done and new requirement nodes added after last done task", () => {
    const doneTime = "2025-01-01T00:00:00Z";
    const laterTime = "2025-01-02T00:00:00Z";
    const doc = makeDoc([
      { type: "task", status: "done", updatedAt: doneTime },
      { type: "requirement", status: "backlog", createdAt: laterTime },
    ]);
    expect(detectCurrentPhase(doc)).toBe("LISTENING");
  });
});

describe("getPhaseGuidance", () => {
  const phases: LifecyclePhase[] = [
    "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "LISTENING",
  ];

  it("should return guidance for every phase", () => {
    for (const phase of phases) {
      const guidance = getPhaseGuidance(phase);
      expect(guidance.reminder).toBeTruthy();
      expect(guidance.suggestedTools.length).toBeGreaterThan(0);
      expect(guidance.principles.length).toBeGreaterThan(0);
    }
  });

  it("should return PT-BR content", () => {
    const guidance = getPhaseGuidance("IMPLEMENT");
    // PT-BR content check — should contain Portuguese words
    expect(guidance.reminder).toMatch(/TDD|implementação|teste/i);
  });

  it("should suggest context and update_status for IMPLEMENT phase", () => {
    const guidance = getPhaseGuidance("IMPLEMENT");
    expect(guidance.suggestedTools).toContain("context");
    expect(guidance.suggestedTools).toContain("update_status");
  });
});
