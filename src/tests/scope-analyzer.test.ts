import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { analyzeScope } from "../core/analyzer/scope-analyzer.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("analyzeScope", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Scope Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return clean scope for empty graph", () => {
    const doc = store.toGraphDocument();
    const result = analyzeScope(doc);

    expect(result.orphans).toHaveLength(0);
    expect(result.cycles).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("should detect orphan requirements without tasks", () => {
    store.insertNode(makeNode({ type: "requirement", title: "Orphan Req" }));

    const doc = store.toGraphDocument();
    const result = analyzeScope(doc);

    expect(result.orphans.length).toBeGreaterThanOrEqual(1);
    expect(result.orphans.some((o) => o.type === "requirement")).toBe(true);
  });

  it("should not flag requirement as orphan if it has child tasks", () => {
    const req = makeNode({ type: "epic", title: "Epic" });
    const task = makeNode({ type: "task", title: "Task", parentId: req.id });
    store.insertNode(req);
    store.insertNode(task);

    const doc = store.toGraphDocument();
    const result = analyzeScope(doc);

    expect(result.orphans.find((o) => o.id === req.id)).toBeUndefined();
  });

  it("should detect orphan tasks without parent or edges", () => {
    store.insertNode(makeNode({ type: "task", title: "Lonely Task" }));

    const doc = store.toGraphDocument();
    const result = analyzeScope(doc);

    expect(result.orphans.some((o) => o.type === "task")).toBe(true);
  });

  it("should calculate coverage matrix", () => {
    const req = makeNode({ type: "epic", title: "Epic" });
    const task = makeNode({ type: "task", title: "Task", parentId: req.id, acceptanceCriteria: ["AC1"] });
    store.insertNode(req);
    store.insertNode(task);

    const doc = store.toGraphDocument();
    const result = analyzeScope(doc);

    expect(result.coverage.requirementsToTasks).toBe(100);
    expect(result.coverage.tasksToAc).toBe(100);
  });

  it("should detect dependency cycles", () => {
    const a = makeNode({ type: "task", title: "A" });
    const b = makeNode({ type: "task", title: "B" });
    store.insertNode(a);
    store.insertNode(b);
    store.insertEdge(makeEdge(a.id, b.id, { relationType: "depends_on" }));
    store.insertEdge(makeEdge(b.id, a.id, { relationType: "depends_on" }));

    const doc = store.toGraphDocument();
    const result = analyzeScope(doc);

    expect(result.cycles.length).toBeGreaterThanOrEqual(1);
  });
});
