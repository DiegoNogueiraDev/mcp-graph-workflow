import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("SqliteStore — mutations", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Mutations Test");
  });

  afterEach(() => {
    store.close();
  });

  // ── updateNode ──────────────────────────────

  it("updates node title", () => {
    const node = makeNode({ title: "Old title" });
    store.insertNode(node);

    const updated = store.updateNode(node.id, { title: "New title" });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("New title");
    // updatedAt is set by the store, so it should be a valid ISO string
    expect(updated!.updatedAt).toBeTruthy();
  });

  it("updates node priority", () => {
    const node = makeNode({ priority: 3 });
    store.insertNode(node);

    const updated = store.updateNode(node.id, { priority: 1 });
    expect(updated!.priority).toBe(1);
  });

  it("updates node sprint", () => {
    const node = makeNode();
    store.insertNode(node);

    const updated = store.updateNode(node.id, { sprint: "sprint-2" });
    expect(updated!.sprint).toBe("sprint-2");

    // Clear sprint
    const cleared = store.updateNode(node.id, { sprint: null });
    expect(cleared!.sprint).toBeUndefined();
  });

  it("updates node tags", () => {
    const node = makeNode();
    store.insertNode(node);

    const updated = store.updateNode(node.id, { tags: ["frontend", "urgent"] });
    expect(updated!.tags).toEqual(["frontend", "urgent"]);
  });

  it("updates node xpSize", () => {
    const node = makeNode();
    store.insertNode(node);

    const updated = store.updateNode(node.id, { xpSize: "XL" });
    expect(updated!.xpSize).toBe("XL");
  });

  it("updates node description", () => {
    const node = makeNode({ description: "old desc" });
    store.insertNode(node);

    const updated = store.updateNode(node.id, { description: "new detailed desc" });
    expect(updated!.description).toBe("new detailed desc");
  });

  it("updates acceptance criteria", () => {
    const node = makeNode();
    store.insertNode(node);

    const updated = store.updateNode(node.id, {
      acceptanceCriteria: ["Must work", "Must be tested"],
    });
    expect(updated!.acceptanceCriteria).toEqual(["Must work", "Must be tested"]);
  });

  it("updates multiple fields at once", () => {
    const node = makeNode();
    store.insertNode(node);

    const updated = store.updateNode(node.id, {
      title: "Multi-update",
      priority: 1,
      sprint: "sprint-3",
      tags: ["hot"],
    });
    expect(updated!.title).toBe("Multi-update");
    expect(updated!.priority).toBe(1);
    expect(updated!.sprint).toBe("sprint-3");
    expect(updated!.tags).toEqual(["hot"]);
  });

  it("returns null for nonexistent node", () => {
    expect(store.updateNode("nonexistent", { title: "Nope" })).toBeNull();
  });

  it("returns existing node when no fields provided", () => {
    const node = makeNode({ title: "Unchanged" });
    store.insertNode(node);

    const result = store.updateNode(node.id, {});
    expect(result!.title).toBe("Unchanged");
  });

  // ── deleteNode ──────────────────────────────

  it("deletes a node", () => {
    const node = makeNode();
    store.insertNode(node);

    expect(store.deleteNode(node.id)).toBe(true);
    expect(store.getNodeById(node.id)).toBeNull();
  });

  it("deletes associated edges when deleting a node", () => {
    const n1 = makeNode();
    const n2 = makeNode();
    const n3 = makeNode();
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertNode(n3);

    store.insertEdge(makeEdge(n1.id, n2.id));
    store.insertEdge(makeEdge(n3.id, n1.id));

    expect(store.getAllEdges()).toHaveLength(2);

    store.deleteNode(n1.id);

    // Both edges should be gone
    expect(store.getAllEdges()).toHaveLength(0);
    // n2 and n3 should still exist
    expect(store.getNodeById(n2.id)).not.toBeNull();
    expect(store.getNodeById(n3.id)).not.toBeNull();
  });

  it("returns false for nonexistent node delete", () => {
    expect(store.deleteNode("nonexistent")).toBe(false);
  });

  // ── deleteEdge ──────────────────────────────

  it("deletes an edge", () => {
    const n1 = makeNode();
    const n2 = makeNode();
    store.insertNode(n1);
    store.insertNode(n2);

    const edge = makeEdge(n1.id, n2.id);
    store.insertEdge(edge);

    expect(store.deleteEdge(edge.id)).toBe(true);
    expect(store.getAllEdges()).toHaveLength(0);
    // Nodes remain
    expect(store.getNodeById(n1.id)).not.toBeNull();
    expect(store.getNodeById(n2.id)).not.toBeNull();
  });

  it("returns false for nonexistent edge delete", () => {
    expect(store.deleteEdge("nonexistent")).toBe(false);
  });

  // ── add_edge validation ──────────────────

  it("creates edge between existing nodes", () => {
    const n1 = makeNode();
    const n2 = makeNode();
    store.insertNode(n1);
    store.insertNode(n2);

    const edge = makeEdge(n1.id, n2.id, { relationType: "blocks" });
    store.insertEdge(edge);

    const edges = store.getAllEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0].relationType).toBe("blocks");
  });

  // ── bulkUpdateStatus ─────────────────────

  it("bulk updates status for valid and invalid IDs", () => {
    const n1 = makeNode({ status: "backlog" });
    const n2 = makeNode({ status: "backlog" });
    const n3 = makeNode({ status: "backlog" });
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertNode(n3);

    const result = store.bulkUpdateStatus(
      [n1.id, n2.id, n3.id, "bad-id"],
      "done",
    );
    expect(result.updated).toHaveLength(3);
    expect(result.notFound).toEqual(["bad-id"]);

    // Verify nodes are actually updated
    expect(store.getNodeById(n1.id)!.status).toBe("done");
    expect(store.getNodeById(n2.id)!.status).toBe("done");
    expect(store.getNodeById(n3.id)!.status).toBe("done");
  });

  it("bulk update with empty ids returns empty arrays", () => {
    const result = store.bulkUpdateStatus([], "done");
    expect(result.updated).toEqual([]);
    expect(result.notFound).toEqual([]);
  });
});
