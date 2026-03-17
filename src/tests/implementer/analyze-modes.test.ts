/**
 * Integration tests for the 3 IMPLEMENT analyze modes.
 * Tests the core functions that the analyze tool calls,
 * using SqliteStore for realistic graph data.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { checkDefinitionOfDone } from "../../core/implementer/definition-of-done.js";
import { checkTddAdherence } from "../../core/implementer/tdd-checker.js";
import { calculateSprintProgress } from "../../core/implementer/sprint-progress.js";
import { makeNode, makeEdge } from "../helpers/factories.js";

describe("analyze mode: implement_done (integration)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return DoD report for a real store task", () => {
    const task = makeNode({
      type: "task",
      status: "in_progress",
      xpSize: "S",
      description: "Implement login",
      acceptanceCriteria: ["Given credentials, When submitted, Then should authenticate and return token"],
    });
    store.insertNode(task);

    const doc = store.toGraphDocument();
    const report = checkDefinitionOfDone(doc, task.id);

    expect(report.nodeId).toBe(task.id);
    expect(report.ready).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(75);
    expect(report.checks).toHaveLength(8);
  });

  it("should fail DoD for task with unresolved blocker in store", () => {
    const blocker = makeNode({ type: "task", status: "backlog" });
    const task = makeNode({
      type: "task",
      status: "in_progress",
      acceptanceCriteria: ["Should return 200"],
    });
    store.insertNode(blocker);
    store.insertNode(task);
    store.insertEdge(makeEdge(task.id, blocker.id, { relationType: "depends_on" }));

    const doc = store.toGraphDocument();
    const report = checkDefinitionOfDone(doc, task.id);

    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === "no_unresolved_blockers")!.passed).toBe(false);
  });
});

describe("analyze mode: tdd_check (integration)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should analyze TDD adherence across multiple tasks in store", () => {
    store.insertNode(makeNode({
      type: "task",
      acceptanceCriteria: ["Given a user\nWhen login\nThen should redirect to dashboard"],
    }));
    store.insertNode(makeNode({
      type: "task",
      acceptanceCriteria: ["Make it nice"],
    }));

    const doc = store.toGraphDocument();
    const report = checkTddAdherence(doc);

    expect(report.tasks).toHaveLength(2);
    expect(report.tasksAtRisk).toBe(1); // "Make it nice" is not testable
    expect(report.overallTestability).toBeGreaterThan(0);
    expect(report.suggestedTestSpecs.length).toBeGreaterThan(0);
  });

  it("should filter by nodeId in store", () => {
    const task1 = makeNode({
      type: "task",
      acceptanceCriteria: ["Should return 200"],
    });
    const task2 = makeNode({
      type: "task",
      acceptanceCriteria: ["Should validate input"],
    });
    store.insertNode(task1);
    store.insertNode(task2);

    const doc = store.toGraphDocument();
    const report = checkTddAdherence(doc, task1.id);

    expect(report.tasks).toHaveLength(1);
    expect(report.tasks[0].nodeId).toBe(task1.id);
  });
});

describe("analyze mode: progress (integration)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should calculate burndown from store tasks", () => {
    store.insertNode(makeNode({ type: "task", status: "done", sprint: "sprint-1" }));
    store.insertNode(makeNode({ type: "task", status: "in_progress", sprint: "sprint-1" }));
    store.insertNode(makeNode({ type: "task", status: "backlog", sprint: "sprint-1" }));

    const doc = store.toGraphDocument();
    const report = calculateSprintProgress(doc, "sprint-1");

    expect(report.sprint).toBe("sprint-1");
    expect(report.burndown.total).toBe(3);
    expect(report.burndown.done).toBe(1);
    expect(report.burndown.inProgress).toBe(1);
    expect(report.burndown.backlog).toBe(1);
    expect(report.burndown.donePercent).toBe(33);
  });

  it("should detect blocked tasks with dependencies in store", () => {
    const blocker = makeNode({ type: "task", status: "backlog", sprint: "s1" });
    const blocked = makeNode({ type: "task", status: "blocked", sprint: "s1" });
    store.insertNode(blocker);
    store.insertNode(blocked);
    store.insertEdge(makeEdge(blocked.id, blocker.id, { relationType: "depends_on" }));

    const doc = store.toGraphDocument();
    const report = calculateSprintProgress(doc, "s1");

    expect(report.blockers).toHaveLength(1);
    expect(report.blockers[0].nodeId).toBe(blocked.id);
    expect(report.blockers[0].blockedBy).toContain(blocker.id);
  });

  it("should include all sprints when no sprint filter provided", () => {
    store.insertNode(makeNode({ type: "task", status: "done", sprint: "s1" }));
    store.insertNode(makeNode({ type: "task", status: "backlog", sprint: "s2" }));

    const doc = store.toGraphDocument();
    const report = calculateSprintProgress(doc);

    expect(report.sprint).toBeNull();
    expect(report.burndown.total).toBe(2);
  });
});
