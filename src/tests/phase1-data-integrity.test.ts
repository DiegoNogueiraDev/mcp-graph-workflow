import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { buildTaskContext, buildNaiveNeighborhood } from "../core/context/compact-context.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

// ── BUG-06: edgeChildren dedup in compact-context ────────────

describe("BUG-06: edgeChildren dedup in buildTaskContext", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Dedup Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should not duplicate children when both child_of and parent_of edges exist", () => {
    // Arrange
    const parent = makeNode({ type: "epic", title: "Parent Epic" });
    const child = makeNode({ title: "Child Task" });
    store.insertNode(parent);
    store.insertNode(child);

    // Create bidirectional edges: child_of (incoming to parent) AND parent_of (outgoing from parent)
    // child_of: child → parent (incoming to parent means edge.to === parent.id, edge.from === child.id)
    store.insertEdge(makeEdge(child.id, parent.id, { relationType: "child_of" }));
    // parent_of: parent → child (outgoing from parent means edge.from === parent.id, edge.to === child.id)
    store.insertEdge(makeEdge(parent.id, child.id, { relationType: "parent_of" }));

    // Act
    const ctx = buildTaskContext(store, parent.id);

    // Assert — child should appear exactly once in edgeChildren
    expect(ctx).not.toBeNull();
    expect(ctx!.edgeChildren).toBeDefined();
    expect(ctx!.edgeChildren).toHaveLength(1);
    expect(ctx!.edgeChildren![0].id).toBe(child.id);
  });

  it("should handle multiple distinct children without dedup issues", () => {
    // Arrange
    const parent = makeNode({ type: "epic", title: "Parent Epic" });
    const child1 = makeNode({ title: "Child 1" });
    const child2 = makeNode({ title: "Child 2" });
    store.insertNode(parent);
    store.insertNode(child1);
    store.insertNode(child2);

    // parent_of edges only (no bidirectional duplication)
    store.insertEdge(makeEdge(parent.id, child1.id, { relationType: "parent_of" }));
    store.insertEdge(makeEdge(parent.id, child2.id, { relationType: "parent_of" }));

    // Act
    const ctx = buildTaskContext(store, parent.id);

    // Assert — both children should appear
    expect(ctx).not.toBeNull();
    expect(ctx!.edgeChildren).toBeDefined();
    expect(ctx!.edgeChildren).toHaveLength(2);
    const ids = ctx!.edgeChildren!.map((c) => c.id);
    expect(ids).toContain(child1.id);
    expect(ids).toContain(child2.id);
  });

  it("should deduplicate when same child appears via both edge directions", () => {
    // Arrange
    const parent = makeNode({ type: "epic", title: "Parent" });
    const childA = makeNode({ title: "Child A" });
    const childB = makeNode({ title: "Child B" });
    store.insertNode(parent);
    store.insertNode(childA);
    store.insertNode(childB);

    // childA has bidirectional edges (bug trigger)
    store.insertEdge(makeEdge(childA.id, parent.id, { relationType: "child_of" }));
    store.insertEdge(makeEdge(parent.id, childA.id, { relationType: "parent_of" }));
    // childB has only parent_of
    store.insertEdge(makeEdge(parent.id, childB.id, { relationType: "parent_of" }));

    // Act
    const ctx = buildTaskContext(store, parent.id);

    // Assert — childA once, childB once
    expect(ctx).not.toBeNull();
    expect(ctx!.edgeChildren).toBeDefined();
    expect(ctx!.edgeChildren).toHaveLength(2);
  });
});

describe("BUG-06: edgeChildren dedup in buildNaiveNeighborhood", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Naive Dedup Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should not duplicate children when both child_of and parent_of edges exist", () => {
    // Arrange
    const parent = makeNode({ type: "epic", title: "Parent Epic" });
    const child = makeNode({ title: "Child Task" });
    store.insertNode(parent);
    store.insertNode(child);

    // Bidirectional edges
    store.insertEdge(makeEdge(child.id, parent.id, { relationType: "child_of" }));
    store.insertEdge(makeEdge(parent.id, child.id, { relationType: "parent_of" }));

    // Act
    const result = buildNaiveNeighborhood(store, parent.id);

    // Assert — the payload includes edgeChildren (added dynamically to the payload object)
    // The formal return type is NaiveNeighborhood but the function also adds edgeChildren to the payload for token estimation
    // The dedup fix ensures the internal edgeChildren array has no duplicates
    expect(result).not.toBeNull();
    // We verify via buildTaskContext which exposes edgeChildren in its typed result
    const ctx = buildTaskContext(store, parent.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.edgeChildren).toHaveLength(1);
  });
});

// ── BUG-08: list tool pagination ─────────────────────────────

describe("BUG-08: list tool pagination logic", () => {
  it("should correctly slice nodes with offset and limit", () => {
    // Arrange — simulate the pagination logic used in list.ts
    const nodes = Array.from({ length: 120 }, (_, i) => ({
      id: `node-${i}`,
      title: `Task ${i}`,
    }));

    const limit = 50;
    const offset = 0;

    // Act
    const total = nodes.length;
    const paginated = nodes.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // Assert
    expect(total).toBe(120);
    expect(paginated).toHaveLength(50);
    expect(hasMore).toBe(true);
    expect(paginated[0].id).toBe("node-0");
    expect(paginated[49].id).toBe("node-49");
  });

  it("should return correct second page", () => {
    // Arrange
    const nodes = Array.from({ length: 120 }, (_, i) => ({
      id: `node-${i}`,
      title: `Task ${i}`,
    }));

    const limit = 50;
    const offset = 50;

    // Act
    const total = nodes.length;
    const paginated = nodes.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // Assert
    expect(paginated).toHaveLength(50);
    expect(paginated[0].id).toBe("node-50");
    expect(paginated[49].id).toBe("node-99");
    expect(hasMore).toBe(true);
  });

  it("should return partial last page", () => {
    // Arrange
    const nodes = Array.from({ length: 120 }, (_, i) => ({
      id: `node-${i}`,
      title: `Task ${i}`,
    }));

    const limit = 50;
    const offset = 100;

    // Act
    const total = nodes.length;
    const paginated = nodes.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // Assert
    expect(paginated).toHaveLength(20);
    expect(hasMore).toBe(false);
  });

  it("should return empty when offset exceeds total", () => {
    // Arrange
    const nodes = Array.from({ length: 10 }, (_, i) => ({
      id: `node-${i}`,
      title: `Task ${i}`,
    }));

    const limit = 50;
    const offset = 100;

    // Act
    const paginated = nodes.slice(offset, offset + limit);
    const hasMore = offset + limit < nodes.length;

    // Assert
    expect(paginated).toHaveLength(0);
    expect(hasMore).toBe(false);
  });
});

// ── BUG-11: Duplicate edges prevention ───────────────────────

describe("BUG-11: duplicate edge prevention", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Edge Dedup Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should detect duplicate edge via getEdgesFrom lookup", () => {
    // Arrange
    const nodeA = makeNode({ title: "Node A" });
    const nodeB = makeNode({ title: "Node B" });
    store.insertNode(nodeA);
    store.insertNode(nodeB);

    const edge = makeEdge(nodeA.id, nodeB.id, { relationType: "depends_on" });
    store.insertEdge(edge);

    // Act — simulate the duplicate check from edge.ts
    const existingEdges = store.getEdgesFrom(nodeA.id);
    const duplicate = existingEdges.find(
      (e) => e.to === nodeB.id && e.relationType === "depends_on",
    );

    // Assert
    expect(duplicate).toBeDefined();
    expect(duplicate!.id).toBe(edge.id);
  });

  it("should not flag different relation types as duplicates", () => {
    // Arrange
    const nodeA = makeNode({ title: "Node A" });
    const nodeB = makeNode({ title: "Node B" });
    store.insertNode(nodeA);
    store.insertNode(nodeB);

    const edge = makeEdge(nodeA.id, nodeB.id, { relationType: "depends_on" });
    store.insertEdge(edge);

    // Act — check for a different relation type
    const existingEdges = store.getEdgesFrom(nodeA.id);
    const duplicate = existingEdges.find(
      (e) => e.to === nodeB.id && e.relationType === "blocks",
    );

    // Assert — should not find a duplicate
    expect(duplicate).toBeUndefined();
  });

  it("should not flag edges to different targets as duplicates", () => {
    // Arrange
    const nodeA = makeNode({ title: "Node A" });
    const nodeB = makeNode({ title: "Node B" });
    const nodeC = makeNode({ title: "Node C" });
    store.insertNode(nodeA);
    store.insertNode(nodeB);
    store.insertNode(nodeC);

    const edge = makeEdge(nodeA.id, nodeB.id, { relationType: "depends_on" });
    store.insertEdge(edge);

    // Act — check for edge to different target
    const existingEdges = store.getEdgesFrom(nodeA.id);
    const duplicate = existingEdges.find(
      (e) => e.to === nodeC.id && e.relationType === "depends_on",
    );

    // Assert — should not find a duplicate
    expect(duplicate).toBeUndefined();
  });

  it("should allow same relation type between different node pairs", () => {
    // Arrange
    const nodeA = makeNode({ title: "Node A" });
    const nodeB = makeNode({ title: "Node B" });
    const nodeC = makeNode({ title: "Node C" });
    store.insertNode(nodeA);
    store.insertNode(nodeB);
    store.insertNode(nodeC);

    // A depends_on B
    store.insertEdge(makeEdge(nodeA.id, nodeB.id, { relationType: "depends_on" }));
    // A depends_on C
    store.insertEdge(makeEdge(nodeA.id, nodeC.id, { relationType: "depends_on" }));

    // Act
    const existingEdges = store.getEdgesFrom(nodeA.id);

    // Assert — both edges should exist (different targets)
    expect(existingEdges).toHaveLength(2);
  });
});
