import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { calculateMetrics } from "../core/insights/metrics-calculator.js";
import { makeNode } from "./helpers/factories.js";

describe("calculateMetrics", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Metrics Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should calculate completion rate", () => {
    store.insertNode(makeNode({ status: "done" }));
    store.insertNode(makeNode({ status: "done" }));
    store.insertNode(makeNode({ status: "backlog" }));
    store.insertNode(makeNode({ status: "in_progress" }));

    const doc = store.toGraphDocument();
    const metrics = calculateMetrics(doc);

    expect(metrics.totalTasks).toBe(4);
    expect(metrics.completionRate).toBe(50);
  });

  it("should calculate status distribution", () => {
    store.insertNode(makeNode({ status: "backlog" }));
    store.insertNode(makeNode({ status: "backlog" }));
    store.insertNode(makeNode({ status: "done" }));

    const doc = store.toGraphDocument();
    const metrics = calculateMetrics(doc);

    const backlog = metrics.statusDistribution.find((d) => d.status === "backlog");
    const done = metrics.statusDistribution.find((d) => d.status === "done");

    expect(backlog?.count).toBe(2);
    expect(done?.count).toBe(1);
  });

  it("should calculate sprint progress", () => {
    store.insertNode(makeNode({ sprint: "sprint-1", status: "done" }));
    store.insertNode(makeNode({ sprint: "sprint-1", status: "backlog" }));
    store.insertNode(makeNode({ sprint: "sprint-2", status: "in_progress" }));

    const doc = store.toGraphDocument();
    const metrics = calculateMetrics(doc);

    expect(metrics.sprintProgress.length).toBe(2);

    const s1 = metrics.sprintProgress.find((s) => s.sprint === "sprint-1");
    expect(s1?.total).toBe(2);
    expect(s1?.done).toBe(1);
    expect(s1?.percentage).toBe(50);
  });

  it("should handle empty graph", () => {
    const doc = store.toGraphDocument();
    const metrics = calculateMetrics(doc);

    expect(metrics.totalNodes).toBe(0);
    expect(metrics.totalTasks).toBe(0);
    expect(metrics.completionRate).toBe(0);
  });
});
