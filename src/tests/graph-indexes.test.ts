import { describe, it, expect } from "vitest";
import { buildIndexes } from "../core/graph/graph-indexes.js";
import type { GraphNode, GraphEdge } from "../core/graph/graph-types.js";

function makeNode(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    type: "task",
    title: `Node ${overrides.id}`,
    status: "backlog",
    priority: 3,
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parentId: null,
    tags: [],
    acceptanceCriteria: [],
    ...overrides,
  } as GraphNode;
}

function makeEdge(overrides: Partial<GraphEdge> & { id: string; from: string; to: string }): GraphEdge {
  return {
    relationType: "depends_on",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as GraphEdge;
}

describe("buildIndexes", () => {
  it("should build byId index mapping node id to array position", () => {
    const nodes = [makeNode({ id: "a" }), makeNode({ id: "b" }), makeNode({ id: "c" })];

    const indexes = buildIndexes(nodes, []);

    expect(indexes.byId).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("should build childrenByParent index", () => {
    const nodes = [
      makeNode({ id: "parent" }),
      makeNode({ id: "child1", parentId: "parent" }),
      makeNode({ id: "child2", parentId: "parent" }),
      makeNode({ id: "orphan" }),
    ];

    const indexes = buildIndexes(nodes, []);

    expect(indexes.childrenByParent["parent"]).toEqual(["child1", "child2"]);
    expect(indexes.childrenByParent["orphan"]).toBeUndefined();
  });

  it("should build outgoingByNode index from edges", () => {
    const nodes = [makeNode({ id: "a" }), makeNode({ id: "b" })];
    const edges = [
      makeEdge({ id: "e1", from: "a", to: "b" }),
      makeEdge({ id: "e2", from: "a", to: "b", relationType: "blocks" }),
    ];

    const indexes = buildIndexes(nodes, edges);

    expect(indexes.outgoingByNode["a"]).toEqual(["e1", "e2"]);
    expect(indexes.outgoingByNode["b"]).toBeUndefined();
  });

  it("should build incomingByNode index from edges", () => {
    const nodes = [makeNode({ id: "a" }), makeNode({ id: "b" })];
    const edges = [
      makeEdge({ id: "e1", from: "a", to: "b" }),
      makeEdge({ id: "e2", from: "a", to: "b", relationType: "blocks" }),
    ];

    const indexes = buildIndexes(nodes, edges);

    expect(indexes.incomingByNode["b"]).toEqual(["e1", "e2"]);
    expect(indexes.incomingByNode["a"]).toBeUndefined();
  });

  it("should handle empty nodes and edges", () => {
    const indexes = buildIndexes([], []);

    expect(indexes.byId).toEqual({});
    expect(indexes.childrenByParent).toEqual({});
    expect(indexes.incomingByNode).toEqual({});
    expect(indexes.outgoingByNode).toEqual({});
  });

  it("should handle multiple children across different parents", () => {
    const nodes = [
      makeNode({ id: "p1" }),
      makeNode({ id: "p2" }),
      makeNode({ id: "c1", parentId: "p1" }),
      makeNode({ id: "c2", parentId: "p2" }),
      makeNode({ id: "c3", parentId: "p1" }),
    ];

    const indexes = buildIndexes(nodes, []);

    expect(indexes.childrenByParent["p1"]).toEqual(["c1", "c3"]);
    expect(indexes.childrenByParent["p2"]).toEqual(["c2"]);
  });

  it("should track edges bidirectionally for the same node pair", () => {
    const nodes = [makeNode({ id: "a" }), makeNode({ id: "b" })];
    const edges = [
      makeEdge({ id: "e1", from: "a", to: "b" }),
      makeEdge({ id: "e2", from: "b", to: "a" }),
    ];

    const indexes = buildIndexes(nodes, edges);

    expect(indexes.outgoingByNode["a"]).toEqual(["e1"]);
    expect(indexes.outgoingByNode["b"]).toEqual(["e2"]);
    expect(indexes.incomingByNode["b"]).toEqual(["e1"]);
    expect(indexes.incomingByNode["a"]).toEqual(["e2"]);
  });
});
