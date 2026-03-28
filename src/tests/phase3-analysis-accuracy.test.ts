import { describe, it, expect } from "vitest";
import { findCriticalPath } from "../core/planner/dependency-chain.js";
import { analyzeCoupling } from "../core/designer/coupling-analyzer.js";
import { buildTraceabilityMatrix } from "../core/designer/traceability-matrix.js";
import { analyzePrdQuality } from "../core/analyzer/prd-quality.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";

function makeNode(overrides: Partial<GraphNode> & { id: string; title: string }): GraphNode {
  return {
    type: "task",
    status: "backlog",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as GraphNode;
}

function makeEdge(from: string, to: string, relationType: string, id?: string): GraphEdge {
  return {
    id: id ?? `edge-${from}-${to}`,
    from,
    to,
    relationType: relationType as GraphEdge["relationType"],
    createdAt: new Date().toISOString(),
  };
}

describe("BUG-07: Critical path with proper depends_on edges", () => {
  it("should return chain A→B→C, not AC nodes", () => {
    const nodeA = makeNode({ id: "a", title: "Task A", type: "task", estimateMinutes: 60 });
    const nodeB = makeNode({ id: "b", title: "Task B", type: "task", estimateMinutes: 120 });
    const nodeC = makeNode({ id: "c", title: "Task C", type: "task", estimateMinutes: 60 });
    const acNode = makeNode({ id: "ac1", title: "AC: should work", type: "acceptance_criteria", estimateMinutes: 30 });

    const doc: GraphDocument = {
      nodes: [nodeA, nodeB, nodeC, acNode],
      edges: [
        makeEdge("b", "a", "depends_on"),  // B depends on A
        makeEdge("c", "b", "depends_on"),  // C depends on B
      ],
      metadata: { version: "1.0", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const path = findCriticalPath(doc);
    const pathIds = path.map((n) => n.id);
    expect(pathIds).toEqual(["a", "b", "c"]);
    expect(pathIds).not.toContain("ac1");
  });
});

describe("BUG-13: Coupling ignores parent_of/child_of edges", () => {
  it("should count parent_of/child_of edges in coupling (Bug #029)", () => {
    const parent = makeNode({ id: "p", title: "Parent" });
    const child1 = makeNode({ id: "c1", title: "Child 1", parentId: "p" });
    const child2 = makeNode({ id: "c2", title: "Child 2", parentId: "p" });
    const dep = makeNode({ id: "d", title: "Dependency" });

    const doc: GraphDocument = {
      nodes: [parent, child1, child2, dep],
      edges: [
        makeEdge("p", "c1", "parent_of"),
        makeEdge("p", "c2", "parent_of"),
        makeEdge("c1", "p", "child_of"),
        makeEdge("c2", "p", "child_of"),
        makeEdge("p", "d", "depends_on"),
      ],
      metadata: { version: "1.0", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const report = analyzeCoupling(doc);
    const parentMetrics = report.nodes.find((m) => m.nodeId === "p");
    // Bug #029: parent_of/child_of now count — parent has 2 parent_of + 1 depends_on fanOut
    expect(parentMetrics?.fanOut).toBe(3);
    // parent has 2 child_of fanIn
    expect(parentMetrics?.fanIn).toBe(2);
  });
});

describe("BUG-14: Traceability includes orphan decisions in coverage", () => {
  it("should report < 100% when decisions are orphaned", () => {
    const d1 = makeNode({ id: "d1", title: "Decision 1", type: "decision" });
    const d2 = makeNode({ id: "d2", title: "Decision 2", type: "decision" });
    const d3 = makeNode({ id: "d3", title: "Decision 3", type: "decision" });

    const doc: GraphDocument = {
      nodes: [d1, d2, d3],
      edges: [],
      metadata: { version: "1.0", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const report = buildTraceabilityMatrix(doc);
    expect(report.coverageRate).toBeLessThan(100);
    expect(report.orphanDecisions).toHaveLength(3);
  });

  it("should report 100% when all decisions are linked", () => {
    const req = makeNode({ id: "r1", title: "Req 1", type: "requirement" });
    const dec = makeNode({ id: "d1", title: "Dec 1", type: "decision" });

    const doc: GraphDocument = {
      nodes: [req, dec],
      edges: [
        makeEdge("d1", "r1", "implements"),
      ],
      metadata: { version: "1.0", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const report = buildTraceabilityMatrix(doc);
    expect(report.coverageRate).toBe(100);
    expect(report.orphanDecisions).toHaveLength(0);
  });
});

describe("BUG-15: prd_quality no artificial bonuses", () => {
  it("should score < 100 when requirements lack descriptions", () => {
    const epic = makeNode({ id: "e1", title: "Epic 1", type: "epic" });
    // No description = issue flagged

    const doc: GraphDocument = {
      nodes: [epic],
      edges: [],
      metadata: { version: "1.0", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const report = analyzePrdQuality(doc);
    expect(report.score).toBeLessThan(100);
  });

  it("should not have strong quality when issues exist", () => {
    const epic = makeNode({ id: "e1", title: "Epic 1", type: "epic" });
    // Epic without description

    const doc: GraphDocument = {
      nodes: [epic],
      edges: [],
      metadata: { version: "1.0", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const report = analyzePrdQuality(doc);
    const reqSection = report.sections.find((s) => s.name === "requirements");
    if (reqSection && reqSection.issues.length > 0) {
      expect(reqSection.quality).not.toBe("strong");
    }
  });
});
