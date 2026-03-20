import { describe, it, expect } from "vitest";
import { getNodeAcTexts, nodeHasAc } from "../core/utils/ac-helpers.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";

function makeNode(overrides: Partial<GraphNode> & { id: string; title: string }): GraphNode {
  return {
    type: "task",
    status: "ready",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
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

describe("getNodeAcTexts", () => {
  it("should return inline AC when present", () => {
    const doc = makeDoc([
      makeNode({ id: "t1", title: "Task 1", acceptanceCriteria: ["AC1", "AC2"] }),
    ]);
    expect(getNodeAcTexts(doc, "t1")).toEqual(["AC1", "AC2"]);
  });

  it("should return child AC titles when inline is empty", () => {
    const doc = makeDoc([
      makeNode({ id: "t1", title: "Task 1" }),
      makeNode({ id: "ac1", title: "Given X When Y Then Z", type: "acceptance_criteria", parentId: "t1" }),
      makeNode({ id: "ac2", title: "Should validate input", type: "acceptance_criteria", parentId: "t1" }),
    ]);
    expect(getNodeAcTexts(doc, "t1")).toEqual(["Given X When Y Then Z", "Should validate input"]);
  });

  it("should prefer inline over children when both exist", () => {
    const doc = makeDoc([
      makeNode({ id: "t1", title: "Task 1", acceptanceCriteria: ["Inline AC"] }),
      makeNode({ id: "ac1", title: "Child AC", type: "acceptance_criteria", parentId: "t1" }),
    ]);
    expect(getNodeAcTexts(doc, "t1")).toEqual(["Inline AC"]);
  });

  it("should return empty array for nonexistent node", () => {
    const doc = makeDoc([]);
    expect(getNodeAcTexts(doc, "nope")).toEqual([]);
  });

  it("should return empty array when no AC anywhere", () => {
    const doc = makeDoc([makeNode({ id: "t1", title: "Task 1" })]);
    expect(getNodeAcTexts(doc, "t1")).toEqual([]);
  });
});

describe("nodeHasAc", () => {
  it("should return true for child AC nodes", () => {
    const doc = makeDoc([
      makeNode({ id: "t1", title: "Task 1" }),
      makeNode({ id: "ac1", title: "AC child", type: "acceptance_criteria", parentId: "t1" }),
    ]);
    expect(nodeHasAc(doc, "t1")).toBe(true);
  });

  it("should return true for inline AC", () => {
    const doc = makeDoc([
      makeNode({ id: "t1", title: "Task 1", acceptanceCriteria: ["AC1"] }),
    ]);
    expect(nodeHasAc(doc, "t1")).toBe(true);
  });

  it("should return false when no AC anywhere", () => {
    const doc = makeDoc([makeNode({ id: "t1", title: "Task 1" })]);
    expect(nodeHasAc(doc, "t1")).toBe(false);
  });
});
