/**
 * TDD tests for buildTaskContext with optional snapshot parameter.
 * Task 2.2: Refactor buildTaskContext to accept snapshot for loop optimization.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore, type TestStoreContext } from "../helpers/test-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";
import { GraphSnapshotCache } from "../../core/store/graph-snapshot-cache.js";
import { generateId } from "../../core/utils/id.js";
import type { GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

describe("buildTaskContext with snapshot", () => {
  let ctx: TestStoreContext;

  beforeEach(() => {
    ctx = createTestStore("SnapshotContextTest");
  });

  afterEach(() => {
    ctx.cleanup();
  });

  function addNode(title: string, parentId?: string): GraphNode {
    const node: GraphNode = {
      id: generateId("node"),
      type: "task",
      title,
      description: `Description for ${title}`,
      status: "backlog",
      priority: 3,
      blocked: false,
      tags: [],
      parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ctx.store.insertNode(node);
    return node;
  }

  function addEdge(from: string, to: string, relationType: string = "depends_on"): GraphEdge {
    const edge: GraphEdge = {
      id: generateId("edge"),
      from,
      to,
      relationType: relationType as GraphEdge["relationType"],
      createdAt: new Date().toISOString(),
    };
    ctx.store.insertEdge(edge);
    return edge;
  }

  it("should accept optional snapshot parameter and return same result as without", () => {
    const parent = addNode("Epic");
    const task = addNode("Task A", parent.id);
    const dep = addNode("Dep B");
    addEdge(task.id, dep.id, "depends_on");

    const cache = new GraphSnapshotCache(ctx.store);
    const snapshot = cache.getCachedSnapshot();

    const withoutSnapshot = buildTaskContext(ctx.store, task.id);
    const withSnapshot = buildTaskContext(ctx.store, task.id, snapshot);

    expect(withoutSnapshot).not.toBeNull();
    expect(withSnapshot).not.toBeNull();
    expect(withSnapshot!.task.title).toBe(withoutSnapshot!.task.title);
    expect(withSnapshot!.dependsOn).toHaveLength(withoutSnapshot!.dependsOn.length);
    expect(withSnapshot!.parent?.title).toBe(withoutSnapshot!.parent?.title);
  });

  it("should work with snapshot containing multiple nodes in a loop", () => {
    const parent = addNode("Epic");
    const tasks = Array.from({ length: 5 }, (_, i) => addNode(`Task ${i}`, parent.id));

    const cache = new GraphSnapshotCache(ctx.store);
    const snapshot = cache.getCachedSnapshot();

    // Build context for all tasks using same snapshot (simulates loop optimization)
    const contexts = tasks.map((t) => buildTaskContext(ctx.store, t.id, snapshot));

    expect(contexts).toHaveLength(5);
    for (const c of contexts) {
      expect(c).not.toBeNull();
      expect(c!.parent?.title).toBe("Epic");
    }
  });

  it("should still work without snapshot (backward compatible)", () => {
    const task = addNode("Solo Task");

    const result = buildTaskContext(ctx.store, task.id);
    expect(result).not.toBeNull();
    expect(result!.task.title).toBe("Solo Task");
  });
});
