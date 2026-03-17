import { describe, it, expect } from "vitest";
import { buildTraceabilityMatrix } from "../../core/designer/traceability-matrix.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Node ${i}`,
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

describe("buildTraceabilityMatrix", () => {
  it("should return empty report when no requirement nodes", () => {
    const doc = makeDoc([{ type: "epic" }, { type: "decision" }]);
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix).toHaveLength(0);
    expect(report.coverageRate).toBe(100);
    expect(report.orphanRequirements).toHaveLength(0);
  });

  it("should mark requirement as 'none' when no linked decisions or constraints", () => {
    const doc = makeDoc([
      { id: "req1", type: "requirement" },
      { id: "dec1", type: "decision" },
    ]);
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix).toHaveLength(1);
    expect(report.matrix[0].coverage).toBe("none");
    expect(report.orphanRequirements).toContain("req1");
    expect(report.coverageRate).toBe(0);
  });

  it("should mark requirement as 'full' when linked to both decision and constraint", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
        { id: "con1", type: "constraint" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix[0].coverage).toBe("full");
    expect(report.matrix[0].linkedDecisions).toContain("dec1");
    expect(report.matrix[0].linkedConstraints).toContain("con1");
    expect(report.coverageRate).toBe(100);
  });

  it("should mark requirement as 'partial' when linked to decision but not constraint", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "derived_from" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix[0].coverage).toBe("partial");
  });

  it("should detect orphan decisions not linked to any requirement", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
        { id: "dec2", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.orphanDecisions).toContain("dec2");
    expect(report.orphanDecisions).not.toContain("dec1");
  });

  it("should follow edges in both directions", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "dec1", to: "req1", relationType: "implements" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix[0].linkedDecisions).toContain("dec1");
  });

  it("should follow parent_of/child_of edges for traceability", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "parent_of" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix[0].linkedDecisions).toContain("dec1");
  });

  it("should calculate correct coverage rate with mixed statuses", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "req2", type: "requirement" },
        { id: "req3", type: "requirement" },
        { id: "dec1", type: "decision" },
        { id: "con1", type: "constraint" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
        { from: "req2", to: "dec1", relationType: "derived_from" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    // req1=full, req2=partial, req3=none
    // coverageRate = 2/3 covered (non-none) ≈ 66.67%
    expect(report.coverageRate).toBeCloseTo(66.67, 0);
    expect(report.orphanRequirements).toContain("req3");
  });

  it("should handle graph with no edges", () => {
    const doc = makeDoc([
      { id: "req1", type: "requirement" },
      { id: "req2", type: "requirement" },
      { id: "dec1", type: "decision" },
    ]);
    const report = buildTraceabilityMatrix(doc);
    expect(report.coverageRate).toBe(0);
    expect(report.orphanRequirements).toHaveLength(2);
    expect(report.orphanDecisions).toHaveLength(1);
  });

  it("should not count non-traceability edge types for coverage", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "task1", type: "task" },
      ],
      [
        { from: "req1", to: "task1", relationType: "depends_on" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    // depends_on to a task, not a decision/constraint — still "none" for traceability
    expect(report.matrix[0].coverage).toBe("none");
  });
});
