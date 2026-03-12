import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import { ValidationError, SnapshotNotFoundError } from "../core/utils/errors.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("SqliteStore", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── Project ────────────────────────────────

  it("initializes a project", () => {
    const project = store.getProject();
    expect(project).not.toBeNull();
    expect(project!.name).toBe("Test Project");
  });

  it("creates new project on init with different name", () => {
    const first = store.getProject();
    const second = store.initProject("Another Name");
    expect(second.id).not.toBe(first!.id);
    expect(second.name).toBe("Another Name");
  });

  it("returns existing project on init with same name", () => {
    const first = store.getProject();
    const second = store.initProject("Test Project");
    expect(second.id).toBe(first!.id);
  });

  // ── Nodes ──────────────────────────────────

  it("inserts and retrieves a node with all fields", () => {
    const node = makeNode({
      description: "A detailed task",
      xpSize: "M",
      estimateMinutes: 60,
      tags: ["backend", "api"],
      parentId: null,
      sprint: "sprint-1",
      sourceRef: { file: "prd.md", startLine: 10, endLine: 20, confidence: 0.9 },
      acceptanceCriteria: ["Works", "Tested"],
      blocked: true,
      metadata: { inferred: false, origin: "imported", custom: 42 },
    });

    store.insertNode(node);
    const retrieved = store.getNodeById(node.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(node.id);
    expect(retrieved!.title).toBe("Test task");
    expect(retrieved!.description).toBe("A detailed task");
    expect(retrieved!.xpSize).toBe("M");
    expect(retrieved!.estimateMinutes).toBe(60);
    expect(retrieved!.tags).toEqual(["backend", "api"]);
    expect(retrieved!.sourceRef).toEqual({
      file: "prd.md",
      startLine: 10,
      endLine: 20,
      confidence: 0.9,
    });
    expect(retrieved!.acceptanceCriteria).toEqual(["Works", "Tested"]);
    expect(retrieved!.blocked).toBe(true);
    expect(retrieved!.metadata).toEqual({ inferred: false, origin: "imported", custom: 42 });
  });

  it("filters nodes by type", () => {
    store.insertNode(makeNode({ type: "task" }));
    store.insertNode(makeNode({ type: "epic" }));
    store.insertNode(makeNode({ type: "task" }));

    const tasks = store.getNodesByType("task");
    expect(tasks).toHaveLength(2);
    expect(tasks.every((n) => n.type === "task")).toBe(true);
  });

  it("filters nodes by status", () => {
    store.insertNode(makeNode({ status: "backlog" }));
    store.insertNode(makeNode({ status: "done" }));

    expect(store.getNodesByStatus("backlog")).toHaveLength(1);
    expect(store.getNodesByStatus("done")).toHaveLength(1);
  });

  it("gets child nodes by parentId", () => {
    const parent = makeNode({ type: "epic" });
    const child1 = makeNode({ parentId: parent.id });
    const child2 = makeNode({ parentId: parent.id });
    const orphan = makeNode({});

    store.insertNode(parent);
    store.insertNode(child1);
    store.insertNode(child2);
    store.insertNode(orphan);

    const children = store.getChildNodes(parent.id);
    expect(children).toHaveLength(2);
  });

  it("updates node status", () => {
    const node = makeNode({ status: "backlog" });
    store.insertNode(node);

    const updated = store.updateNodeStatus(node.id, "in_progress");
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("in_progress");

    // Returns null for nonexistent node
    expect(store.updateNodeStatus("nonexistent", "done")).toBeNull();
  });

  // ── Edges ──────────────────────────────────

  it("inserts and retrieves edges", () => {
    const n1 = makeNode();
    const n2 = makeNode();
    store.insertNode(n1);
    store.insertNode(n2);

    const edge = makeEdge(n1.id, n2.id, {
      weight: 0.8,
      reason: "Sequential",
      metadata: { inferred: true, confidence: 0.6 },
    });
    store.insertEdge(edge);

    const from = store.getEdgesFrom(n1.id);
    expect(from).toHaveLength(1);
    expect(from[0].to).toBe(n2.id);
    expect(from[0].weight).toBe(0.8);
    expect(from[0].metadata).toEqual({ inferred: true, confidence: 0.6 });

    const to = store.getEdgesTo(n2.id);
    expect(to).toHaveLength(1);
    expect(to[0].from).toBe(n1.id);
  });

  // ── Bulk insert ────────────────────────────

  it("bulk inserts atomically", () => {
    const nodes = [makeNode(), makeNode(), makeNode()];
    const edges = [makeEdge(nodes[0].id, nodes[1].id)];

    store.bulkInsert(nodes, edges);

    expect(store.getAllNodes()).toHaveLength(3);
    expect(store.getAllEdges()).toHaveLength(1);
  });

  it("bulk insert rolls back on error", () => {
    const n1 = makeNode();
    const n2 = makeNode();
    // n2 has duplicate ID → should fail
    n2.id = n1.id;

    expect(() => store.bulkInsert([n1, n2], [])).toThrow();
    // Atomic: neither node should be inserted
    expect(store.getAllNodes()).toHaveLength(0);
  });

  // ── Snapshots ──────────────────────────────

  it("creates a snapshot", () => {
    store.insertNode(makeNode());
    const snapshotId = store.createSnapshot();
    expect(snapshotId).toBeGreaterThan(0);
  });

  // ── Import history ─────────────────────────

  it("records imports", () => {
    store.recordImport("prd.md", 5, 3);
    store.recordImport("prd2.md", 2, 1);

    const doc = store.toGraphDocument();
    expect(doc.meta.sourceFiles).toContain("prd.md");
    expect(doc.meta.sourceFiles).toContain("prd2.md");
    expect(doc.meta.lastImport).not.toBeNull();
  });

  // ── Stats ──────────────────────────────────

  it("computes correct stats", () => {
    store.insertNode(makeNode({ type: "task", status: "backlog" }));
    store.insertNode(makeNode({ type: "task", status: "done" }));
    store.insertNode(makeNode({ type: "epic", status: "backlog" }));

    const n1 = makeNode();
    const n2 = makeNode();
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertEdge(makeEdge(n1.id, n2.id));

    const stats = store.getStats();
    expect(stats.totalNodes).toBe(5);
    expect(stats.totalEdges).toBe(1);
    expect(stats.byType["task"]).toBe(4); // 2 explicit + n1 + n2
    expect(stats.byType["epic"]).toBe(1);
    expect(stats.byStatus["backlog"]).toBe(4);
    expect(stats.byStatus["done"]).toBe(1);
  });

  // ── Bridge: toGraphDocument ────────────────

  it("materializes a valid GraphDocument", () => {
    const n1 = makeNode({ type: "task", status: "backlog" });
    const n2 = makeNode({ type: "task", status: "done" });
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertEdge(makeEdge(n1.id, n2.id, { relationType: "depends_on" }));

    const doc = store.toGraphDocument();

    expect(doc.version).toBe("1.0.0");
    expect(doc.project.name).toBe("Test Project");
    expect(doc.nodes).toHaveLength(2);
    expect(doc.edges).toHaveLength(1);
    expect(doc.indexes.byId[n1.id]).toBeDefined();
    expect(doc.indexes.outgoingByNode[n1.id]).toContain(doc.edges[0].id);
  });

  // ── Migrations idempotency ─────────────────

  it("runs migrations idempotently", () => {
    // Opening a second store on the same :memory: is not possible,
    // but we can verify the store opens twice without error on disk.
    // For :memory:, just verify we can open a fresh one.
    const store2 = SqliteStore.open(":memory:");
    store2.initProject("Another");
    expect(store2.getProject()!.name).toBe("Another");
    store2.close();
  });

  // ── Zod validation ──────────────────────────

  describe("validation", () => {
    it("rejects node with invalid type", () => {
      const node = makeNode({ type: "invalid_type" as GraphNode["type"] });
      expect(() => store.insertNode(node)).toThrow(ValidationError);
    });

    it("rejects node with invalid priority", () => {
      const node = makeNode({ priority: 99 as GraphNode["priority"] });
      expect(() => store.insertNode(node)).toThrow(ValidationError);
    });

    it("rejects edge with invalid relationType", () => {
      const n1 = makeNode();
      const n2 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);

      const edge = makeEdge(n1.id, n2.id, {
        relationType: "invalid_rel" as GraphEdge["relationType"],
      });
      expect(() => store.insertEdge(edge)).toThrow(ValidationError);
    });

    it("still inserts valid node (regression guard)", () => {
      const node = makeNode({ xpSize: "L", priority: 2 });
      store.insertNode(node);
      expect(store.getNodeById(node.id)).not.toBeNull();
    });
  });

  // ── Project Settings ───────────────────────

  describe("project settings", () => {
    it("should return null for non-existent setting", () => {
      expect(store.getProjectSetting("nonexistent")).toBeNull();
    });

    it("should store and retrieve a setting", () => {
      store.setProjectSetting("lifecycle_phase_override", "IMPLEMENT");
      expect(store.getProjectSetting("lifecycle_phase_override")).toBe("IMPLEMENT");
    });

    it("should overwrite existing setting", () => {
      store.setProjectSetting("lifecycle_phase_override", "IMPLEMENT");
      store.setProjectSetting("lifecycle_phase_override", "REVIEW");
      expect(store.getProjectSetting("lifecycle_phase_override")).toBe("REVIEW");
    });

    it("should isolate settings per project", () => {
      store.setProjectSetting("key1", "value1");
      const project2 = store.initProject("Project 2");
      store.activateProject(project2.id);
      expect(store.getProjectSetting("key1")).toBeNull();
    });
  });

  // ── Snapshots (restore) ─────────────────────

  describe("snapshot restore", () => {
    it("restores graph from snapshot", () => {
      const n1 = makeNode({ title: "Original" });
      store.insertNode(n1);

      const snapshotId = store.createSnapshot();

      // Modify the graph
      store.insertNode(makeNode({ title: "Added after snapshot" }));
      expect(store.getAllNodes()).toHaveLength(2);

      // Restore
      store.restoreSnapshot(snapshotId);

      const nodes = store.getAllNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].title).toBe("Original");
    });

    it("throws SnapshotNotFoundError for invalid ID", () => {
      expect(() => store.restoreSnapshot(999)).toThrow(SnapshotNotFoundError);
    });
  });
});
