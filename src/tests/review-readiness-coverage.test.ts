import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkReviewReadiness } from "../core/reviewer/review-readiness.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge } from "./helpers/factories.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

function buildDoc(store: SqliteStore): GraphDocument {
  return store.toGraphDocument();
}

describe("checkReviewReadiness", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Review Readiness Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return a result for an empty graph", () => {
    const doc = buildDoc(store);
    const report = checkReviewReadiness(doc);

    expect(report).toHaveProperty("checks");
    expect(report).toHaveProperty("ready");
    expect(report).toHaveProperty("score");
    expect(report).toHaveProperty("grade");
    expect(report).toHaveProperty("summary");
    expect(report.checks.length).toBeGreaterThan(0);
  });

  it("should report ready when all tasks are done with AC", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Task 1",
      status: "done",
      acceptanceCriteria: ["AC 1"],
    }));
    store.insertNode(makeNode({
      type: "task",
      title: "Task 2",
      status: "done",
      acceptanceCriteria: ["AC 2"],
    }));

    const doc = buildDoc(store);
    const report = checkReviewReadiness(doc);

    expect(report.ready).toBe(true);
    expect(report.summary).toContain("Review Ready");
  });

  it("should report not ready when tasks are not done", () => {
    store.insertNode(makeNode({ type: "task", title: "Task 1", status: "backlog" }));
    store.insertNode(makeNode({ type: "task", title: "Task 2", status: "backlog" }));
    store.insertNode(makeNode({ type: "task", title: "Task 3", status: "backlog" }));

    const doc = buildDoc(store);
    const report = checkReviewReadiness(doc);

    expect(report.ready).toBe(false);
    expect(report.summary).toContain("Review Not Ready");
    const completionCheck = report.checks.find((c) => c.name === "completion_rate");
    expect(completionCheck?.passed).toBe(false);
  });

  it("should pass completion_rate when exactly 80% tasks are done", () => {
    // 4 done out of 5 = 80%
    for (let i = 0; i < 4; i++) {
      store.insertNode(makeNode({
        type: "task",
        title: `Done task ${i}`,
        status: "done",
        acceptanceCriteria: [`AC ${i}`],
      }));
    }
    store.insertNode(makeNode({ type: "task", title: "Remaining task", status: "in_progress" }));

    const doc = buildDoc(store);
    const report = checkReviewReadiness(doc);

    const completionCheck = report.checks.find((c) => c.name === "completion_rate");
    expect(completionCheck?.passed).toBe(true);
  });

  it("should check ac_coverage on done tasks", () => {
    // 2 done tasks, only 1 has AC => 50% < 70%
    store.insertNode(makeNode({
      type: "task",
      title: "Done with AC",
      status: "done",
      acceptanceCriteria: ["AC 1"],
    }));
    store.insertNode(makeNode({
      type: "task",
      title: "Done without AC",
      status: "done",
    }));

    const doc = buildDoc(store);
    const report = checkReviewReadiness(doc);

    const acCheck = report.checks.find((c) => c.name === "ac_coverage");
    expect(acCheck?.passed).toBe(false);
    expect(acCheck?.details).toContain("50%");
  });

  it("should detect dependency cycles", () => {
    const n1 = makeNode({ type: "task", title: "Task A", status: "done", acceptanceCriteria: ["AC"] });
    const n2 = makeNode({ type: "task", title: "Task B", status: "done", acceptanceCriteria: ["AC"] });
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertEdge(makeEdge(n1.id, n2.id, { relationType: "depends_on" }));
    store.insertEdge(makeEdge(n2.id, n1.id, { relationType: "depends_on" }));

    const doc = buildDoc(store);
    const report = checkReviewReadiness(doc);

    const cycleCheck = report.checks.find((c) => c.name === "no_cycles");
    expect(cycleCheck?.passed).toBe(false);
  });

  it("should include recommended checks in the report", () => {
    const doc = buildDoc(store);
    const report = checkReviewReadiness(doc);

    const recommendedChecks = report.checks.filter((c) => c.severity === "recommended");
    expect(recommendedChecks.length).toBeGreaterThan(0);

    const checkNames = recommendedChecks.map((c) => c.name);
    expect(checkNames).toContain("velocity_stable");
    expect(checkNames).toContain("no_orphan_tasks");
    expect(checkNames).toContain("no_oversized_tasks");
  });

  it("should compute score and grade from check results", () => {
    // All done with AC → most checks should pass
    store.insertNode(makeNode({
      type: "task",
      title: "Task 1",
      status: "done",
      acceptanceCriteria: ["Given X, When Y, Then Z"],
    }));

    const doc = buildDoc(store);
    const report = checkReviewReadiness(doc);

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
  });
});
