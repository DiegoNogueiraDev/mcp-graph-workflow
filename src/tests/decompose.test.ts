import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { detectLargeTasks } from "../core/planner/decompose.js";
import { makeNode } from "./helpers/factories.js";

describe("detectLargeTasks", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Decompose Test");
  });

  afterEach(() => {
    store.close();
  });

  it("detects task with high estimate (>120min)", () => {
    const node = makeNode({ estimateMinutes: 180, title: "Big task" });
    store.insertNode(node);

    const doc = store.toGraphDocument();
    const results = detectLargeTasks(doc);

    expect(results).toHaveLength(1);
    expect(results[0].node.id).toBe(node.id);
    expect(results[0].reasons.some((r) => r.includes("180min"))).toBe(true);
  });

  it("detects XL task by xpSize", () => {
    const node = makeNode({ xpSize: "XL", title: "XL task" });
    store.insertNode(node);

    const doc = store.toGraphDocument();
    const results = detectLargeTasks(doc);

    expect(results).toHaveLength(1);
    expect(results[0].reasons.some((r) => r.includes("XL"))).toBe(true);
  });

  it("excludes tasks that already have children", () => {
    const parent = makeNode({ estimateMinutes: 200, title: "Parent" });
    const child = makeNode({ parentId: parent.id, title: "Child" });
    store.insertNode(parent);
    store.insertNode(child);

    const doc = store.toGraphDocument();
    const results = detectLargeTasks(doc);

    expect(results.find((r) => r.node.id === parent.id)).toBeUndefined();
  });

  it("returns empty array when no large tasks exist", () => {
    store.insertNode(makeNode({ estimateMinutes: 30, xpSize: "S" }));

    const doc = store.toGraphDocument();
    const results = detectLargeTasks(doc);

    expect(results).toHaveLength(0);
  });

  it("can be filtered by nodeId", () => {
    const n1 = makeNode({ estimateMinutes: 200, title: "Big 1" });
    const n2 = makeNode({ estimateMinutes: 200, title: "Big 2" });
    store.insertNode(n1);
    store.insertNode(n2);

    const doc = store.toGraphDocument();
    const all = detectLargeTasks(doc);
    expect(all).toHaveLength(2);

    const filtered = all.filter((r) => r.node.id === n1.id);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].node.title).toBe("Big 1");
  });
});
