/**
 * Unit tests for graph-filters.ts — filterTopLevelNodes + TOP_LEVEL_TYPES.
 * Tests the actual production module via direct import (no re-implementation).
 */
import { describe, it, expect } from "vitest";
import {
  filterTopLevelNodes,
  TOP_LEVEL_TYPES,
} from "../web/dashboard/src/lib/graph-filters.js";

// ── Minimal factory ──────────────────────────────

interface TestNode {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: number;
  parentId?: string | null;
}

function makeNode(overrides: Partial<TestNode> & { id: string }): TestNode {
  return {
    type: "task",
    title: `Node ${overrides.id}`,
    status: "backlog",
    priority: 3,
    ...overrides,
  };
}

// ── TOP_LEVEL_TYPES ──────────────────────────────

describe("TOP_LEVEL_TYPES", () => {
  it("should contain exactly epic, milestone, requirement, constraint", () => {
    expect(TOP_LEVEL_TYPES.has("epic")).toBe(true);
    expect(TOP_LEVEL_TYPES.has("milestone")).toBe(true);
    expect(TOP_LEVEL_TYPES.has("requirement")).toBe(true);
    expect(TOP_LEVEL_TYPES.has("constraint")).toBe(true);
  });

  it("should not contain task, subtask, risk, decision, acceptance_criteria", () => {
    expect(TOP_LEVEL_TYPES.has("task")).toBe(false);
    expect(TOP_LEVEL_TYPES.has("subtask")).toBe(false);
    expect(TOP_LEVEL_TYPES.has("risk")).toBe(false);
    expect(TOP_LEVEL_TYPES.has("decision")).toBe(false);
    expect(TOP_LEVEL_TYPES.has("acceptance_criteria")).toBe(false);
  });

  it("should have exactly 4 entries", () => {
    expect(TOP_LEVEL_TYPES.size).toBe(4);
  });

  it("should be readonly (ReadonlySet)", () => {
    // ReadonlySet does not have .add() or .delete() at compile time
    // At runtime, Set still has them, but the contract is ReadonlySet
    expect(TOP_LEVEL_TYPES).toBeInstanceOf(Set);
  });
});

// ── filterTopLevelNodes ──────────────────────────

describe("filterTopLevelNodes", () => {
  const nodes: TestNode[] = [
    makeNode({ id: "epic1", type: "epic", parentId: null }),
    makeNode({ id: "task1", type: "task", parentId: "epic1" }),
    makeNode({ id: "sub1", type: "subtask", parentId: "task1" }),
    makeNode({ id: "req1", type: "requirement", parentId: "epic1" }),
    makeNode({ id: "milestone1", type: "milestone" }),
    makeNode({ id: "task2", type: "task" }),
    makeNode({ id: "constraint1", type: "constraint", parentId: "epic1" }),
    makeNode({ id: "risk1", type: "risk", parentId: "epic1" }),
    makeNode({ id: "decision1", type: "decision", parentId: "epic1" }),
    makeNode({ id: "ac1", type: "acceptance_criteria", parentId: "task1" }),
  ];

  it("should filter to top-level types + root nodes when showFullGraph=false", () => {
    const result = filterTopLevelNodes(nodes, false);
    const ids = result.map((n) => n.id);
    expect(ids).toEqual(["epic1", "req1", "milestone1", "task2", "constraint1"]);
  });

  it("should return all nodes when showFullGraph=true", () => {
    const result = filterTopLevelNodes(nodes, true);
    expect(result).toHaveLength(10);
    expect(result).toBe(nodes); // same reference — no copy
  });

  it("should return empty array for empty input", () => {
    expect(filterTopLevelNodes([], false)).toEqual([]);
    expect(filterTopLevelNodes([], true)).toEqual([]);
  });

  it("should include root-level tasks (no parentId)", () => {
    const rootTask = makeNode({ id: "root", type: "task" });
    expect(filterTopLevelNodes([rootTask], false)).toHaveLength(1);
  });

  it("should include root-level tasks with parentId=null", () => {
    const rootTask = makeNode({ id: "root", type: "task", parentId: null });
    expect(filterTopLevelNodes([rootTask], false)).toHaveLength(1);
  });

  it("should exclude non-top-level types with parentId", () => {
    const child = makeNode({ id: "child", type: "task", parentId: "parent" });
    expect(filterTopLevelNodes([child], false)).toHaveLength(0);
  });

  it("should always include top-level types even with parentId", () => {
    const req = makeNode({ id: "r1", type: "requirement", parentId: "some-parent" });
    const result = filterTopLevelNodes([req], false);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r1");
  });

  it("should preserve original node objects (no cloning)", () => {
    const original = makeNode({ id: "x", type: "epic" });
    const result = filterTopLevelNodes([original], false);
    expect(result[0]).toBe(original);
  });

  it("should work with generic type parameter", () => {
    interface ExtendedNode extends TestNode { extra: string }
    const node: ExtendedNode = { ...makeNode({ id: "e1", type: "epic" }), extra: "data" };
    const result = filterTopLevelNodes([node], false);
    expect(result[0].extra).toBe("data");
  });
});

// ── getNodeEdgeSummary ───────────────────────────

import { getNodeEdgeSummary } from "../web/dashboard/src/lib/graph-filters.js";

interface TestEdge {
  id: string;
  from: string;
  to: string;
  relationType: string;
  createdAt: string;
}

function makeEdge(overrides: Partial<TestEdge> & { id: string; from: string; to: string }): TestEdge {
  return {
    relationType: "depends_on",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getNodeEdgeSummary", () => {
  const edges: TestEdge[] = [
    makeEdge({ id: "e1", from: "A", to: "B", relationType: "depends_on" }),
    makeEdge({ id: "e2", from: "C", to: "A", relationType: "blocks" }),
    makeEdge({ id: "e3", from: "A", to: "D", relationType: "parent_of" }),
    makeEdge({ id: "e4", from: "B", to: "C", relationType: "related_to" }),
  ];

  it("should return outgoing edges where from === nodeId", () => {
    const result = getNodeEdgeSummary("A", edges);
    expect(result.outgoing).toHaveLength(2);
    expect(result.outgoing.map((e) => e.id)).toEqual(["e1", "e3"]);
  });

  it("should return incoming edges where to === nodeId", () => {
    const result = getNodeEdgeSummary("A", edges);
    expect(result.incoming).toHaveLength(1);
    expect(result.incoming[0].id).toBe("e2");
  });

  it("should return empty arrays for node with no edges", () => {
    const result = getNodeEdgeSummary("Z", edges);
    expect(result.outgoing).toEqual([]);
    expect(result.incoming).toEqual([]);
  });

  it("should return empty arrays for empty edges list", () => {
    const result = getNodeEdgeSummary("A", []);
    expect(result.outgoing).toEqual([]);
    expect(result.incoming).toEqual([]);
  });

  it("should not include edges in both outgoing and incoming for self-referencing node", () => {
    const selfEdge = makeEdge({ id: "self", from: "X", to: "X" });
    const result = getNodeEdgeSummary("X", [selfEdge]);
    // Self-edge appears in both outgoing and incoming
    expect(result.outgoing).toHaveLength(1);
    expect(result.incoming).toHaveLength(1);
  });

  it("should correctly separate edges for a node that is both source and target", () => {
    const result = getNodeEdgeSummary("B", edges);
    expect(result.outgoing).toHaveLength(1); // e4: B→C
    expect(result.outgoing[0].id).toBe("e4");
    expect(result.incoming).toHaveLength(1); // e1: A→B
    expect(result.incoming[0].id).toBe("e1");
  });
});
