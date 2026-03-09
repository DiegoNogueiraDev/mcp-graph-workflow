import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { detectBottlenecks } from "../core/insights/bottleneck-detector.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("detectBottlenecks", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Bottleneck Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should detect blocked tasks with unresolved dependencies", () => {
    const taskA = makeNode({ title: "Task A", status: "backlog" });
    const taskB = makeNode({ title: "Task B", status: "backlog" });
    store.insertNode(taskA);
    store.insertNode(taskB);
    store.insertEdge(makeEdge(taskB.id, taskA.id));

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.blockedTasks.length).toBe(1);
    expect(report.blockedTasks[0].title).toBe("Task B");
  });

  it("should not flag tasks whose dependencies are done", () => {
    const taskA = makeNode({ title: "Task A", status: "done" });
    const taskB = makeNode({ title: "Task B", status: "backlog" });
    store.insertNode(taskA);
    store.insertNode(taskB);
    store.insertEdge(makeEdge(taskB.id, taskA.id));

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.blockedTasks.length).toBe(0);
  });

  it("should detect tasks missing acceptance criteria", () => {
    const task = makeNode({ title: "No AC task", type: "task", status: "backlog" });
    const taskWithAC = makeNode({
      title: "With AC",
      type: "task",
      status: "backlog",
      acceptanceCriteria: ["Works"],
    });
    store.insertNode(task);
    store.insertNode(taskWithAC);

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.missingAcceptanceCriteria.length).toBe(1);
    expect(report.missingAcceptanceCriteria[0].title).toBe("No AC task");
  });

  it("should detect oversized tasks", () => {
    const bigTask = makeNode({
      title: "Big task",
      estimateMinutes: 480,
      status: "backlog",
    });
    const smallTask = makeNode({
      title: "Small task",
      estimateMinutes: 30,
      status: "backlog",
    });
    store.insertNode(bigTask);
    store.insertNode(smallTask);

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.oversizedTasks.length).toBe(1);
    expect(report.oversizedTasks[0].title).toBe("Big task");
    expect(report.oversizedTasks[0].estimateMinutes).toBe(480);
  });

  it("should return empty report when no bottlenecks exist", () => {
    const task = makeNode({
      title: "Clean task",
      status: "done",
      acceptanceCriteria: ["Tested"],
    });
    store.insertNode(task);

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.blockedTasks.length).toBe(0);
    expect(report.missingAcceptanceCriteria.length).toBe(0);
    expect(report.oversizedTasks.length).toBe(0);
  });

  // ── blocks edges ──────────────────────────────────────────

  it("should detect blocked tasks via blocks edges", () => {
    const blocker = makeNode({ title: "Blocker", status: "in_progress" });
    const blocked = makeNode({ title: "Blocked by blocks edge", status: "backlog" });
    store.insertNode(blocker);
    store.insertNode(blocked);
    // blocker blocks blocked: edge from blocker to blocked
    store.insertEdge(makeEdge(blocker.id, blocked.id, { relationType: "blocks" }));

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.blockedTasks.some((t) => t.title === "Blocked by blocks edge")).toBe(true);
    expect(report.blockedTasks.find((t) => t.title === "Blocked by blocks edge")!.blockerIds).toContain(blocker.id);
  });

  it("should not flag blocks edge when blocker is done", () => {
    const blocker = makeNode({ title: "Done blocker", status: "done" });
    const task = makeNode({ title: "Unblocked now", status: "backlog", acceptanceCriteria: ["AC"] });
    store.insertNode(blocker);
    store.insertNode(task);
    store.insertEdge(makeEdge(blocker.id, task.id, { relationType: "blocks" }));

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.blockedTasks.some((t) => t.title === "Unblocked now")).toBe(false);
  });

  // ── edge-based decomposition ──────────────────────────────

  it("should exclude oversized tasks with edge-based children (parent_of)", () => {
    const bigTask = makeNode({ title: "Big decomposed", estimateMinutes: 480, status: "backlog" });
    const child = makeNode({ title: "Sub part", status: "backlog" });
    store.insertNode(bigTask);
    store.insertNode(child);
    store.insertEdge(makeEdge(bigTask.id, child.id, { relationType: "parent_of" }));

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.oversizedTasks.some((t) => t.title === "Big decomposed")).toBe(false);
  });

  it("should exclude oversized tasks with edge-based children (child_of)", () => {
    const bigTask = makeNode({ title: "Big decomposed child_of", estimateMinutes: 480, status: "backlog" });
    const child = makeNode({ title: "Sub part child_of", status: "backlog" });
    store.insertNode(bigTask);
    store.insertNode(child);
    // child_of: child -> bigTask means child is child of bigTask
    store.insertEdge(makeEdge(child.id, bigTask.id, { relationType: "child_of" }));

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report.oversizedTasks.some((t) => t.title === "Big decomposed child_of")).toBe(false);
  });
});
