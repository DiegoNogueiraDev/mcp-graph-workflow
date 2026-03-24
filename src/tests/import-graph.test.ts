import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge, makeEpic } from "./helpers/factories.js";
import { mergeGraph } from "../core/importer/import-graph.js";
import type { GraphDocument } from "../core/graph/graph-types.js";
import { buildIndexes } from "../core/graph/graph-indexes.js";

function makeGraphDocument(
  nodes: ReturnType<typeof makeNode>[],
  edges: ReturnType<typeof makeEdge>[],
  overrides: Partial<GraphDocument> = {},
): GraphDocument {
  return {
    version: "1.0.0",
    project: {
      id: "proj_remote",
      name: "Remote Project",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    nodes,
    edges,
    indexes: buildIndexes(nodes, edges),
    meta: { sourceFiles: [], lastImport: null },
    ...overrides,
  };
}

describe("mergeGraph — graph import with merge semantics", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Local Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── Empty local graph ─────────────────────────

  it("should insert all nodes and edges into an empty graph", () => {
    const n1 = makeNode({ title: "Remote Task 1" });
    const n2 = makeNode({ title: "Remote Task 2" });
    const e1 = makeEdge(n1.id, n2.id);
    const doc = makeGraphDocument([n1, n2], [e1]);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(2);
    expect(result.nodesSkipped).toBe(0);
    expect(result.edgesInserted).toBe(1);
    expect(result.edgesSkipped).toBe(0);
    expect(result.edgesOrphaned).toBe(0);
    expect(result.sourceProject).toBe("Remote Project");

    expect(store.getAllNodes()).toHaveLength(2);
    expect(store.getNodeById(n1.id)).not.toBeNull();
    expect(store.getNodeById(n2.id)).not.toBeNull();
  });

  // ── No overlap ────────────────────────────────

  it("should insert all when no overlap with local nodes", () => {
    const local = makeNode({ title: "Local Task" });
    store.insertNode(local);

    const remote = makeNode({ title: "Remote Task" });
    const doc = makeGraphDocument([remote], []);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(1);
    expect(result.nodesSkipped).toBe(0);
    expect(store.getAllNodes()).toHaveLength(2);
  });

  // ── Full overlap (idempotent) ─────────────────

  it("should skip all when all nodes already exist (idempotent re-import)", () => {
    const n1 = makeNode({ title: "Shared Task" });
    const n2 = makeNode({ title: "Other Task" });
    const e1 = makeEdge(n1.id, n2.id);
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertEdge(e1);

    const doc = makeGraphDocument([n1, n2], [e1]);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(0);
    expect(result.nodesSkipped).toBe(2);
    expect(result.edgesInserted).toBe(0);
    expect(result.edgesSkipped).toBe(1);
    expect(store.getAllNodes()).toHaveLength(2);
  });

  // ── Partial overlap ───────────────────────────

  it("should insert new nodes and skip existing ones in partial overlap", () => {
    const existing = makeNode({ title: "Existing Task" });
    store.insertNode(existing);

    const newNode = makeNode({ title: "New Remote Task" });
    const doc = makeGraphDocument([existing, newNode], []);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(1);
    expect(result.nodesSkipped).toBe(1);
    expect(store.getAllNodes()).toHaveLength(2);
    expect(store.getNodeById(newNode.id)?.title).toBe("New Remote Task");
  });

  // ── Local version preserved ───────────────────

  it("should keep local version when node ID conflicts", () => {
    const nodeId = "node_aaaaaaaaaaaa";
    const localNode = makeNode({ id: nodeId, title: "Local Version", status: "in_progress" });
    store.insertNode(localNode);

    const remoteNode = makeNode({ id: nodeId, title: "Remote Version", status: "done" });
    const doc = makeGraphDocument([remoteNode], []);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(0);
    expect(result.nodesSkipped).toBe(1);

    const stored = store.getNodeById(nodeId);
    expect(stored?.title).toBe("Local Version");
    expect(stored?.status).toBe("in_progress");
  });

  // ── Orphaned edges ────────────────────────────

  it("should skip edges referencing nodes that do not exist locally or in import", () => {
    const n1 = makeNode({ title: "Only Node" });
    const orphanEdge = makeEdge(n1.id, "node_nonexistent123");
    const doc = makeGraphDocument([n1], [orphanEdge]);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(1);
    expect(result.edgesInserted).toBe(0);
    expect(result.edgesOrphaned).toBe(1);
  });

  // ── Edges referencing existing local nodes ────

  it("should insert edges that reference existing local nodes", () => {
    const localNode = makeNode({ title: "Local" });
    store.insertNode(localNode);

    const remoteNode = makeNode({ title: "Remote" });
    const crossEdge = makeEdge(localNode.id, remoteNode.id);
    const doc = makeGraphDocument([remoteNode], [crossEdge]);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(1);
    expect(result.edgesInserted).toBe(1);
    expect(result.edgesOrphaned).toBe(0);
  });

  // ── Edge deduplication (same from/to/relationType) ──

  it("should skip duplicate edges with same from/to/relationType", () => {
    const n1 = makeNode({ title: "A" });
    const n2 = makeNode({ title: "B" });
    store.insertNode(n1);
    store.insertNode(n2);
    const localEdge = makeEdge(n1.id, n2.id, { relationType: "depends_on" });
    store.insertEdge(localEdge);

    // Remote has same edge with different ID
    const remoteEdge = makeEdge(n1.id, n2.id, { relationType: "depends_on" });
    const doc = makeGraphDocument([n1, n2], [remoteEdge]);

    const result = mergeGraph(store, doc);

    expect(result.edgesSkipped).toBe(1);
    expect(result.edgesInserted).toBe(0);
  });

  // ── Parent-child relationships ────────────────

  it("should preserve parent-child relationships from imported nodes", () => {
    const epic = makeEpic({ title: "Remote Epic" });
    const task = makeNode({ title: "Remote Task", parentId: epic.id });
    const parentEdge = makeEdge(epic.id, task.id, { relationType: "parent_of" });
    const doc = makeGraphDocument([epic, task], [parentEdge]);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(2);
    expect(result.edgesInserted).toBe(1);

    const importedTask = store.getNodeById(task.id);
    expect(importedTask?.parentId).toBe(epic.id);
  });

  // ── Dry run ───────────────────────────────────

  it("should return correct counts without writing in dry_run mode", () => {
    const n1 = makeNode({ title: "Remote Task" });
    const n2 = makeNode({ title: "Another Task" });
    const e1 = makeEdge(n1.id, n2.id);
    const doc = makeGraphDocument([n1, n2], [e1]);

    const result = mergeGraph(store, doc, { dryRun: true });

    expect(result.nodesInserted).toBe(2);
    expect(result.nodesSkipped).toBe(0);
    expect(result.edgesInserted).toBe(1);

    // Nothing should have been written
    expect(store.getAllNodes()).toHaveLength(0);
  });

  it("should not create snapshot in dry_run mode", () => {
    const n1 = makeNode({ title: "Remote" });
    const doc = makeGraphDocument([n1], []);

    mergeGraph(store, doc, { dryRun: true });

    // No snapshot should exist (only the initial state)
    const snapshots = store.listSnapshots();
    expect(snapshots).toHaveLength(0);
  });

  // ── Snapshot before merge ─────────────────────

  it("should create a snapshot before performing the merge", () => {
    const n1 = makeNode({ title: "Remote" });
    const doc = makeGraphDocument([n1], []);

    mergeGraph(store, doc);

    const snapshots = store.listSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
  });

  // ── Import history recorded ───────────────────

  it("should record the merge in import history", () => {
    const n1 = makeNode({ title: "Remote" });
    const doc = makeGraphDocument([n1], []);

    mergeGraph(store, doc);

    expect(store.hasImport("merge:Remote Project")).toBe(true);
  });

  // ── Metadata origin tracking ──────────────────

  it("should tag imported nodes with origin metadata", () => {
    const n1 = makeNode({ title: "Remote Task" });
    const doc = makeGraphDocument([n1], []);

    mergeGraph(store, doc);

    const imported = store.getNodeById(n1.id);
    expect(imported?.metadata?.mergedFrom).toBe("Remote Project");
  });

  // ── Validation error ──────────────────────────

  it("should throw ValidationError for invalid graph document", () => {
    const badDoc = { version: "1.0.0", nodes: [] } as unknown as GraphDocument;

    expect(() => mergeGraph(store, badDoc)).toThrow("Validation failed");
  });

  // ── Large merge ───────────────────────────────

  it("should handle merging many nodes efficiently", () => {
    const nodes = Array.from({ length: 100 }, (_, i) =>
      makeNode({ title: `Task ${i}` }),
    );
    const edges = nodes.slice(1).map((n, i) =>
      makeEdge(nodes[i].id, n.id),
    );
    const doc = makeGraphDocument(nodes, edges);

    const result = mergeGraph(store, doc);

    expect(result.nodesInserted).toBe(100);
    expect(result.edgesInserted).toBe(99);
    expect(store.getAllNodes()).toHaveLength(100);
  });
});
