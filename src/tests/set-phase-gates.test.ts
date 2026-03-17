import { describe, it, expect } from "vitest";
import { validatePhaseTransition } from "../core/planner/lifecycle-phase.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
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

  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: fullNodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("set_phase gate validation", () => {
  describe("forward transitions with gates", () => {
    it("should block ANALYZE → DESIGN without requirements", () => {
      const doc = makeDoc([{ type: "task", status: "backlog" }]);
      const result = validatePhaseTransition(doc, "ANALYZE", "DESIGN");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("epic");
    });

    it("should allow ANALYZE → DESIGN with requirement", () => {
      const doc = makeDoc([{ type: "requirement", status: "backlog" }]);
      const result = validatePhaseTransition(doc, "ANALYZE", "DESIGN");
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeNull();
    });

    it("should block DESIGN → PLAN without decisions", () => {
      const doc = makeDoc([{ type: "epic", status: "backlog" }]);
      const result = validatePhaseTransition(doc, "DESIGN", "PLAN");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("decision");
    });

    it("should block PLAN → IMPLEMENT without sprints", () => {
      const doc = makeDoc([{ type: "task", status: "backlog" }]);
      const result = validatePhaseTransition(doc, "PLAN", "IMPLEMENT");
      expect(result.allowed).toBe(false);
    });

    it("should block IMPLEMENT → VALIDATE with 0% done", () => {
      const doc = makeDoc([
        { type: "task", status: "backlog" },
        { type: "task", status: "backlog" },
      ]);
      const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
      expect(result.allowed).toBe(false);
    });

    it("should block VALIDATE → REVIEW with 50% done", () => {
      const doc = makeDoc([
        { type: "task", status: "done" },
        { type: "task", status: "backlog" },
      ]);
      // 50% < 80%
      const result = validatePhaseTransition(doc, "VALIDATE", "REVIEW");
      expect(result.allowed).toBe(false);
    });

    it("should allow VALIDATE → REVIEW with 100% done", () => {
      const doc = makeDoc([
        { type: "task", status: "done" },
        { type: "task", status: "done" },
      ]);
      const result = validatePhaseTransition(doc, "VALIDATE", "REVIEW");
      expect(result.allowed).toBe(true);
    });

    it("should block REVIEW → HANDOFF with incomplete tasks", () => {
      const doc = makeDoc([
        { type: "task", status: "done" },
        { type: "task", status: "ready" },
      ]);
      const result = validatePhaseTransition(doc, "REVIEW", "HANDOFF");
      expect(result.allowed).toBe(false);
    });
  });

  describe("transitions without gates", () => {
    it("should allow backward transition IMPLEMENT → PLAN (no gate)", () => {
      const doc = makeDoc();
      const result = validatePhaseTransition(doc, "IMPLEMENT", "PLAN");
      expect(result.allowed).toBe(true);
    });

    it("should allow LISTENING → ANALYZE (no gate)", () => {
      const doc = makeDoc();
      const result = validatePhaseTransition(doc, "LISTENING", "ANALYZE");
      expect(result.allowed).toBe(true);
    });

    it("should allow skip transitions like ANALYZE → IMPLEMENT (no gate for skip)", () => {
      const doc = makeDoc();
      // No gate for non-sequential transitions
      const result = validatePhaseTransition(doc, "ANALYZE", "IMPLEMENT");
      expect(result.allowed).toBe(true);
    });
  });

  describe("gate result details", () => {
    it("should provide unmetConditions with actionable instructions", () => {
      const doc = makeDoc();
      const result = validatePhaseTransition(doc, "ANALYZE", "DESIGN");
      expect(result.unmetConditions.length).toBeGreaterThan(0);
      expect(result.unmetConditions[0]).toContain("epic");
    });

    it("should provide percentage in IMPLEMENT → VALIDATE unmet conditions", () => {
      const doc = makeDoc([
        { type: "task", status: "done" },
        { type: "task", status: "backlog" },
        { type: "task", status: "backlog" },
        { type: "task", status: "backlog" },
      ]);
      const result = validatePhaseTransition(doc, "IMPLEMENT", "VALIDATE");
      expect(result.unmetConditions.some((c) => c.includes("50%") || c.includes("25%"))).toBe(true);
    });

    it("should return null reason when gate passes", () => {
      const doc = makeDoc([{ type: "epic", status: "backlog" }]);
      const result = validatePhaseTransition(doc, "ANALYZE", "DESIGN");
      expect(result.reason).toBeNull();
      expect(result.unmetConditions).toHaveLength(0);
    });
  });
});
