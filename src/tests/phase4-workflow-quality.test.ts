import { describe, it, expect } from "vitest";
import { findNextTask } from "../core/planner/next-task.js";
import { generateTddHints, generateTddHintsFromTexts } from "../core/implementer/tdd-checker.js";
import { validateAcQuality } from "../core/analyzer/ac-validator.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

function makeDoc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0.0",
    project: {
      id: "test",
      name: "Test",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    meta: { sourceFiles: [], lastImport: null },
    nodes,
    edges,
    indexes: {
      byId: {},
      childrenByParent: {},
      incomingByNode: {},
      outgoingByNode: {},
    },
  };
}

describe("BUG-16: next considers blocking impact", () => {
  it("should prefer task with more dependents at same priority", () => {
    // Arrange
    const taskA = makeNode({ id: "a", title: "Task A", priority: 3 });
    const taskB = makeNode({ id: "b", title: "Task B", priority: 3 });
    const dep1 = makeNode({ id: "d1", title: "Dep 1", status: "backlog" });
    const dep2 = makeNode({ id: "d2", title: "Dep 2", status: "backlog" });

    const doc = makeDoc(
      [taskA, taskB, dep1, dep2],
      [
        makeEdge("d1", "a", { relationType: "depends_on" }),  // d1 depends on a
        makeEdge("d2", "a", { relationType: "depends_on" }),  // d2 depends on a
        // taskB has no dependents
      ],
    );

    // Act
    const result = findNextTask(doc);

    // Assert
    expect(result?.node.id).toBe("a");
  });

  it("should not change order when blocking impact is equal", () => {
    // Arrange
    const taskA = makeNode({ id: "a", title: "Task A", priority: 2 });
    const taskB = makeNode({ id: "b", title: "Task B", priority: 3 });

    const doc = makeDoc([taskA, taskB]);

    // Act
    const result = findNextTask(doc);

    // Assert — priority still wins when impact is equal
    expect(result?.node.id).toBe("a");
  });
});

describe("BUG-17: TDD hints from AC child nodes", () => {
  it("generateTddHintsFromTexts should generate hints from text array", () => {
    // Arrange
    const acTexts = [
      "Given a user, When they login, Then they see the dashboard",
      "Returns 200 OK on success",
    ];

    // Act
    const hints = generateTddHintsFromTexts(acTexts);

    // Assert
    expect(hints.length).toBeGreaterThan(0);
  });

  it("generateTddHintsFromTexts returns empty for empty array", () => {
    // Act
    const hints = generateTddHintsFromTexts([]);

    // Assert
    expect(hints).toEqual([]);
  });

  it("generateTddHints returns empty for node without inline AC", () => {
    // Arrange
    const node = makeNode({ id: "t1", title: "No AC" });

    // Act
    const hints = generateTddHints(node);

    // Assert
    expect(hints).toEqual([]);
  });
});

describe("BUG-20: AC validator finds child AC nodes", () => {
  it("should validate AC from child nodes when inline AC is empty", () => {
    // Arrange
    const task = makeNode({ id: "t1", title: "Task 1", type: "task" });
    const ac1 = makeNode({
      id: "ac1",
      title: "Given X, When Y, Then Z",
      type: "acceptance_criteria",
      parentId: "t1",
    });
    const ac2 = makeNode({
      id: "ac2",
      title: "Returns 200 on success",
      type: "acceptance_criteria",
      parentId: "t1",
    });
    const ac3 = makeNode({
      id: "ac3",
      title: "Shows error message on failure",
      type: "acceptance_criteria",
      parentId: "t1",
    });

    const doc = makeDoc([task, ac1, ac2, ac3]);

    // Act
    const report = validateAcQuality(doc, "t1");

    // Assert — should have found and validated the 3 AC child nodes
    expect(report.nodes.length).toBeGreaterThan(0);
    const taskReport = report.nodes.find((n) => n.nodeId === "t1");
    expect(taskReport).toBeDefined();
  });

  it("should prefer inline AC over child AC nodes", () => {
    // Arrange
    const task = makeNode({
      id: "t1",
      title: "Task 1",
      type: "task",
      acceptanceCriteria: ["Returns 200 on valid request"],
    });
    const childAc = makeNode({
      id: "ac1",
      title: "Some child AC",
      type: "acceptance_criteria",
      parentId: "t1",
    });

    const doc = makeDoc([task, childAc]);

    // Act
    const report = validateAcQuality(doc, "t1");

    // Assert — should use inline AC, not child nodes
    const taskReport = report.nodes.find((n) => n.nodeId === "t1");
    expect(taskReport).toBeDefined();
    expect(taskReport!.parsedAcs.length).toBe(1);
  });

  it("should include child task/subtask nodes when nodeId is provided", () => {
    // Arrange
    const parentTask = makeNode({
      id: "t1",
      title: "Parent task",
      type: "task",
      acceptanceCriteria: ["Returns 200"],
    });
    const childTask = makeNode({
      id: "t2",
      title: "Child task",
      type: "task",
      parentId: "t1",
      acceptanceCriteria: ["Returns 400 on bad request"],
    });

    const doc = makeDoc([parentTask, childTask]);

    // Act
    const report = validateAcQuality(doc, "t1");

    // Assert — should include both parent and child task
    expect(report.nodes.length).toBe(2);
  });
});
