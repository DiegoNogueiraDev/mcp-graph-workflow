import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { estimateTokens } from "../core/context/token-estimator.js";
import { buildTaskContext } from "../core/context/compact-context.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("token-estimator", () => {
  it("estimates tokens as ceil(chars / 4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("a".repeat(100))).toBe(25);
    expect(estimateTokens("a".repeat(101))).toBe(26);
  });
});

describe("compact-context", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Context Test");
  });

  afterEach(() => {
    store.close();
  });

  it("returns null for nonexistent node", () => {
    expect(buildTaskContext(store, "nonexistent")).toBeNull();
  });

  it("builds context for a simple task", () => {
    const task = makeNode({ title: "Build login page", description: "Create the login UI" });
    store.insertNode(task);

    const ctx = buildTaskContext(store, task.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.task.id).toBe(task.id);
    expect(ctx!.task.title).toBe("Build login page");
    expect(ctx!.parent).toBeNull();
    expect(ctx!.children).toHaveLength(0);
    expect(ctx!.blockers).toHaveLength(0);
    expect(ctx!.dependsOn).toHaveLength(0);
  });

  it("includes parent context", () => {
    const epic = makeNode({ type: "epic", title: "Auth epic" });
    const task = makeNode({ title: "Login task", parentId: epic.id });
    store.insertNode(epic);
    store.insertNode(task);

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.parent).not.toBeNull();
    expect(ctx!.parent!.title).toBe("Auth epic");
  });

  it("includes children", () => {
    const parent = makeNode({ type: "epic", title: "Parent" });
    const child1 = makeNode({ title: "Child 1", parentId: parent.id });
    const child2 = makeNode({ title: "Child 2", parentId: parent.id });
    store.insertNode(parent);
    store.insertNode(child1);
    store.insertNode(child2);

    const ctx = buildTaskContext(store, parent.id);
    expect(ctx!.children).toHaveLength(2);
  });

  it("includes blockers", () => {
    const task = makeNode({ title: "Blocked task" });
    const blocker = makeNode({ title: "Blocker task", status: "in_progress" });
    store.insertNode(task);
    store.insertNode(blocker);
    store.insertEdge(
      makeEdge(blocker.id, task.id, {
        relationType: "blocks",
        metadata: { inferred: true },
      }),
    );

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.blockers).toHaveLength(1);
    expect(ctx!.blockers[0].title).toBe("Blocker task");
    expect(ctx!.blockers[0].inferred).toBe(true);
  });

  it("includes dependencies with resolved status", () => {
    const dep = makeNode({ title: "Dependency", status: "done" });
    const task = makeNode({ title: "Dependent task" });
    store.insertNode(dep);
    store.insertNode(task);
    store.insertEdge(makeEdge(task.id, dep.id, { relationType: "depends_on" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.dependsOn).toHaveLength(1);
    expect(ctx!.dependsOn[0].resolved).toBe(true);
  });

  it("includes acceptance criteria", () => {
    const task = makeNode({
      title: "AC task",
      acceptanceCriteria: ["Must pass tests", "Must be documented"],
    });
    store.insertNode(task);

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.acceptanceCriteria).toEqual(["Must pass tests", "Must be documented"]);
  });

  it("includes source reference", () => {
    const task = makeNode({
      title: "Sourced task",
      sourceRef: { file: "prd.md", startLine: 10, endLine: 20, confidence: 0.9 },
    });
    store.insertNode(task);

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.sourceRef).toEqual({
      file: "prd.md",
      startLine: 10,
      endLine: 20,
      confidence: 0.9,
    });
  });

  it("calculates reduction metrics", () => {
    const task = makeNode({
      title: "Task with lots of data",
      description: "A very long description ".repeat(50),
      acceptanceCriteria: Array.from({ length: 10 }, (_, i) => `Criteria ${i}`),
    });
    store.insertNode(task);

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.metrics.originalChars).toBeGreaterThan(0);
    expect(ctx!.metrics.compactChars).toBeGreaterThan(0);
    expect(ctx!.metrics.estimatedTokens).toBeGreaterThan(0);
    // Bug #034: reductionPercent can be negative when context expands (more metadata than original)
    expect(typeof ctx!.metrics.reductionPercent).toBe("number");
  });

  // ── related_to edges (bidirectional) ──────────────────────

  it("includes related nodes from related_to edges (outgoing)", () => {
    const task = makeNode({ title: "Main task" });
    const related = makeNode({ title: "Related task", status: "in_progress" });
    store.insertNode(task);
    store.insertNode(related);
    store.insertEdge(makeEdge(task.id, related.id, { relationType: "related_to" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.relatedNodes).toHaveLength(1);
    expect(ctx!.relatedNodes![0].title).toBe("Related task");
  });

  it("includes related nodes from related_to edges (incoming)", () => {
    const task = makeNode({ title: "Main task" });
    const related = makeNode({ title: "Related incoming", status: "ready" });
    store.insertNode(task);
    store.insertNode(related);
    store.insertEdge(makeEdge(related.id, task.id, { relationType: "related_to" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.relatedNodes).toHaveLength(1);
    expect(ctx!.relatedNodes![0].title).toBe("Related incoming");
  });

  it("deduplicates related nodes from both directions", () => {
    const task = makeNode({ title: "Main task" });
    const related = makeNode({ title: "Bidirectional related" });
    store.insertNode(task);
    store.insertNode(related);
    store.insertEdge(makeEdge(task.id, related.id, { relationType: "related_to" }));
    store.insertEdge(makeEdge(related.id, task.id, { relationType: "related_to" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.relatedNodes).toHaveLength(1);
  });

  // ── implements edges ──────────────────────────────────────

  it("includes implements nodes from outgoing implements edges", () => {
    const task = makeNode({ title: "Impl task" });
    const spec = makeNode({ type: "requirement", title: "Login spec" });
    store.insertNode(task);
    store.insertNode(spec);
    store.insertEdge(makeEdge(task.id, spec.id, { relationType: "implements" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.implementsNodes).toHaveLength(1);
    expect(ctx!.implementsNodes![0].title).toBe("Login spec");
  });

  // ── derived_from edges ────────────────────────────────────

  it("includes derived_from nodes from outgoing derived_from edges", () => {
    const task = makeNode({ title: "Derived task" });
    const origin = makeNode({ type: "epic", title: "Origin epic" });
    store.insertNode(task);
    store.insertNode(origin);
    store.insertEdge(makeEdge(task.id, origin.id, { relationType: "derived_from" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.derivedFromNodes).toHaveLength(1);
    expect(ctx!.derivedFromNodes![0].title).toBe("Origin epic");
  });

  // ── edge-based parent/children ────────────────────────────

  it("includes edge-based parent from incoming parent_of edge", () => {
    const task = makeNode({ title: "Child task" });
    const edgeParent = makeNode({ type: "epic", title: "Edge parent" });
    store.insertNode(task);
    store.insertNode(edgeParent);
    // parent_of: edgeParent -> task means edgeParent is parent of task
    store.insertEdge(makeEdge(edgeParent.id, task.id, { relationType: "parent_of" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.edgeParent).not.toBeNull();
    expect(ctx!.edgeParent!.title).toBe("Edge parent");
  });

  it("includes edge-based parent from incoming parent_of edge", () => {
    const task = makeNode({ title: "Child task" });
    const edgeParent = makeNode({ type: "epic", title: "Edge parent via parent_of" });
    store.insertNode(task);
    store.insertNode(edgeParent);
    // parent_of: edgeParent -> task means edgeParent is parent of task
    store.insertEdge(makeEdge(edgeParent.id, task.id, { relationType: "parent_of" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.edgeParent).not.toBeNull();
    expect(ctx!.edgeParent!.title).toBe("Edge parent via parent_of");
  });

  it("includes edge-based children from outgoing parent_of edges", () => {
    const parent = makeNode({ type: "epic", title: "Edge parent" });
    const child1 = makeNode({ title: "Edge child 1" });
    const child2 = makeNode({ title: "Edge child 2" });
    store.insertNode(parent);
    store.insertNode(child1);
    store.insertNode(child2);
    store.insertEdge(makeEdge(parent.id, child1.id, { relationType: "parent_of" }));
    store.insertEdge(makeEdge(parent.id, child2.id, { relationType: "parent_of" }));

    const ctx = buildTaskContext(store, parent.id);
    expect(ctx!.edgeChildren).toHaveLength(2);
  });

  it("includes edge-based children from outgoing parent_of edge (single child)", () => {
    const parent = makeNode({ type: "epic", title: "Edge parent" });
    const child = makeNode({ title: "Edge child via parent_of" });
    store.insertNode(parent);
    store.insertNode(child);
    // parent_of: parent -> child means parent is parent of child
    store.insertEdge(makeEdge(parent.id, child.id, { relationType: "parent_of" }));

    const ctx = buildTaskContext(store, parent.id);
    expect(ctx!.edgeChildren).toHaveLength(1);
    expect(ctx!.edgeChildren![0].title).toBe("Edge child via parent_of");
  });

  it("edge-based hierarchy is independent from parentId hierarchy", () => {
    const parentIdParent = makeNode({ type: "epic", title: "ParentId parent" });
    const edgeParentNode = makeNode({ type: "epic", title: "Edge parent" });
    const task = makeNode({ title: "Task with both", parentId: parentIdParent.id });
    store.insertNode(parentIdParent);
    store.insertNode(edgeParentNode);
    store.insertNode(task);
    store.insertEdge(makeEdge(edgeParentNode.id, task.id, { relationType: "parent_of" }));

    const ctx = buildTaskContext(store, task.id);
    expect(ctx!.parent!.title).toBe("ParentId parent");
    expect(ctx!.edgeParent!.title).toBe("Edge parent");
  });
});
