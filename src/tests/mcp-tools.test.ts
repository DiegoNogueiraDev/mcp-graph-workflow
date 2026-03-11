/**
 * Tests for MCP tool logic. Since tool handlers are thin wrappers around
 * SqliteStore, we test the same operations the tools perform,
 * verifying the store API contracts that each tool depends on.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { findNextTask } from "../core/planner/next-task.js";
import { calculateVelocity } from "../core/planner/velocity.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import type { GraphNode } from "../core/graph/graph-types.js";
import { makeNode } from "./helpers/factories.js";

describe("MCP Tool Logic", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  // ── init tool ──────────────────────────────

  describe("init", () => {
    it("creates a project with custom name", () => {
      const project = store.initProject("My Project");
      expect(project.name).toBe("My Project");
      expect(project.id).toBeTruthy();
    });

    it("creates a project with default name", () => {
      const project = store.initProject();
      expect(project.name).toBe("Local MCP Graph");
    });

    it("creates new project on init with different name", () => {
      const first = store.initProject("First");
      const second = store.initProject("Second");
      expect(second.id).not.toBe(first.id);
      expect(second.name).toBe("Second");
    });

    it("returns existing project on init with same name", () => {
      const first = store.initProject("First");
      const second = store.initProject("First");
      expect(second.id).toBe(first.id);
    });
  });

  // ── list tool ──────────────────────────────

  describe("list", () => {
    it("returns empty list when no nodes", () => {
      store.initProject();
      expect(store.getAllNodes()).toHaveLength(0);
    });

    it("filters by type", () => {
      store.initProject();
      store.insertNode(makeNode({ type: "task" }));
      store.insertNode(makeNode({ type: "epic" }));
      store.insertNode(makeNode({ type: "task" }));

      const tasks = store.getNodesByType("task");
      expect(tasks).toHaveLength(2);
      expect(tasks.every((n) => n.type === "task")).toBe(true);
    });

    it("filters by status", () => {
      store.initProject();
      store.insertNode(makeNode({ status: "backlog" }));
      store.insertNode(makeNode({ status: "done" }));

      const backlog = store.getNodesByStatus("backlog");
      expect(backlog).toHaveLength(1);
      expect(backlog[0].status).toBe("backlog");
    });

    it("filters by both type and status", () => {
      store.initProject();
      store.insertNode(makeNode({ type: "task", status: "backlog" }));
      store.insertNode(makeNode({ type: "task", status: "done" }));
      store.insertNode(makeNode({ type: "epic", status: "backlog" }));

      const nodes = store
        .getNodesByType("task")
        .filter((n) => n.status === "backlog");
      expect(nodes).toHaveLength(1);
    });
  });

  // ── show tool ──────────────────────────────

  describe("show", () => {
    it("returns node with edges and children", () => {
      store.initProject();
      const parent = makeNode({ type: "epic", title: "Parent Epic" });
      const child = makeNode({ parentId: parent.id, title: "Child Task" });
      store.insertNode(parent);
      store.insertNode(child);
      store.insertEdge({
        id: generateId("edge"),
        from: parent.id,
        to: child.id,
        relationType: "parent_of",
        createdAt: now(),
      });

      const node = store.getNodeById(parent.id);
      expect(node).not.toBeNull();
      expect(node!.title).toBe("Parent Epic");

      const edgesFrom = store.getEdgesFrom(parent.id);
      expect(edgesFrom).toHaveLength(1);
      expect(edgesFrom[0].to).toBe(child.id);

      const children = store.getChildNodes(parent.id);
      expect(children).toHaveLength(1);
      expect(children[0].title).toBe("Child Task");
    });

    it("returns null for nonexistent node", () => {
      store.initProject();
      expect(store.getNodeById("nonexistent")).toBeNull();
    });
  });

  // ── update_status tool ─────────────────────

  describe("update_status", () => {
    it("updates node status", () => {
      store.initProject();
      const node = makeNode({ status: "backlog" });
      store.insertNode(node);

      const updated = store.updateNodeStatus(node.id, "in_progress");
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("in_progress");
    });

    it("returns null for nonexistent node", () => {
      store.initProject();
      expect(store.updateNodeStatus("nonexistent", "done")).toBeNull();
    });
  });

  // ── next tool ──────────────────────────────

  describe("next", () => {
    it("returns null when no tasks exist", () => {
      store.initProject();
      const doc = store.toGraphDocument();
      const result = findNextTask(doc);
      expect(result).toBeNull();
    });

    it("suggests highest-priority unblocked task", () => {
      store.initProject();
      const timestamp = now();
      store.insertNode(makeNode({ title: "Low prio", priority: 5, createdAt: timestamp }));
      store.insertNode(makeNode({ title: "High prio", priority: 1, createdAt: timestamp }));

      const doc = store.toGraphDocument();
      const result = findNextTask(doc);
      expect(result).not.toBeNull();
      expect(result!.node.title).toBe("High prio");
    });

    it("skips blocked tasks", () => {
      store.initProject();
      store.insertNode(makeNode({ title: "Blocked", priority: 1, blocked: true }));
      store.insertNode(makeNode({ title: "Available", priority: 3 }));

      const doc = store.toGraphDocument();
      const result = findNextTask(doc);
      expect(result).not.toBeNull();
      expect(result!.node.title).toBe("Available");
    });
  });

  // ── stats tool ─────────────────────────────

  describe("stats", () => {
    it("returns correct counts", () => {
      store.initProject("Stats Project");
      store.insertNode(makeNode({ type: "task", status: "backlog" }));
      store.insertNode(makeNode({ type: "task", status: "done" }));
      store.insertNode(makeNode({ type: "epic", status: "backlog" }));

      const stats = store.getStats();
      expect(stats.totalNodes).toBe(3);
      expect(stats.totalEdges).toBe(0);
      expect(stats.byType["task"]).toBe(2);
      expect(stats.byType["epic"]).toBe(1);
      expect(stats.byStatus["backlog"]).toBe(2);
      expect(stats.byStatus["done"]).toBe(1);
    });
  });

  // ── velocity tool ────────────────────────────

  describe("velocity", () => {
    it("returns zero metrics for empty graph", () => {
      store.initProject();
      const doc = store.toGraphDocument();
      const result = calculateVelocity(doc);
      expect(result.overall.totalTasksCompleted).toBe(0);
      expect(result.overall.totalPoints).toBe(0);
      expect(result.sprints).toHaveLength(0);
    });

    it("computes correct points for done tasks with sprint", () => {
      store.initProject();
      // XP_SIZE_POINTS: XS=1, S=2, M=3, L=5, XL=8
      store.insertNode(makeNode({ status: "done", sprint: "sprint-1", xpSize: "M" }));
      store.insertNode(makeNode({ status: "done", sprint: "sprint-1", xpSize: "L" }));
      store.insertNode(makeNode({ status: "backlog", sprint: "sprint-1", xpSize: "XL" }));

      const doc = store.toGraphDocument();
      const result = calculateVelocity(doc);

      const sprint1 = result.sprints.find((s) => s.sprint === "sprint-1");
      expect(sprint1).toBeDefined();
      expect(sprint1!.tasksCompleted).toBe(2);
      expect(sprint1!.totalPoints).toBe(8); // M=3 + L=5
    });
  });

  // ── add_node tool ───────────────────────────

  describe("add_node", () => {
    it("creates a node via insertNode", () => {
      store.initProject();
      const _timestamp = now();
      const node = makeNode({ title: "Created via add_node" });
      store.insertNode(node);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe("Created via add_node");
      expect(retrieved!.status).toBe("backlog");
    });

    it("creates parent/child edges when parentId is provided", () => {
      store.initProject();
      const parent = makeNode({ type: "epic", title: "Parent" });
      store.insertNode(parent);

      const child = makeNode({ parentId: parent.id, title: "Child" });
      store.insertNode(child);
      store.insertEdge({
        id: generateId("edge"),
        from: parent.id,
        to: child.id,
        relationType: "parent_of",
        createdAt: now(),
      });
      store.insertEdge({
        id: generateId("edge"),
        from: child.id,
        to: parent.id,
        relationType: "child_of",
        createdAt: now(),
      });

      const edgesFrom = store.getEdgesFrom(parent.id);
      expect(edgesFrom.some((e) => e.to === child.id && e.relationType === "parent_of")).toBe(true);
      const edgesFromChild = store.getEdgesFrom(child.id);
      expect(edgesFromChild.some((e) => e.to === parent.id && e.relationType === "child_of")).toBe(true);
    });

    it("rejects node with nonexistent parentId", () => {
      store.initProject();
      const parent = store.getNodeById("nonexistent");
      expect(parent).toBeNull();
    });
  });

  // ── delete_edge tool ───────────────────────

  describe("delete_edge", () => {
    it("deletes an existing edge", () => {
      store.initProject();
      const n1 = makeNode({ title: "A" });
      const n2 = makeNode({ title: "B" });
      store.insertNode(n1);
      store.insertNode(n2);
      const edgeId = generateId("edge");
      store.insertEdge({
        id: edgeId,
        from: n1.id,
        to: n2.id,
        relationType: "depends_on",
        createdAt: now(),
      });

      const deleted = store.deleteEdge(edgeId);
      expect(deleted).toBe(true);
      expect(store.getAllEdges()).toHaveLength(0);
    });

    it("returns false for nonexistent edge", () => {
      store.initProject();
      const deleted = store.deleteEdge("nonexistent");
      expect(deleted).toBe(false);
    });
  });

  // ── list_edges tool ────────────────────────

  describe("list_edges", () => {
    it("lists all edges", () => {
      store.initProject();
      const n1 = makeNode({ title: "A" });
      const n2 = makeNode({ title: "B" });
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertEdge({
        id: generateId("edge"),
        from: n1.id,
        to: n2.id,
        relationType: "depends_on",
        createdAt: now(),
      });

      const edges = store.getAllEdges();
      expect(edges).toHaveLength(1);
    });

    it("filters edges by node and direction", () => {
      store.initProject();
      const n1 = makeNode({ title: "A" });
      const n2 = makeNode({ title: "B" });
      const n3 = makeNode({ title: "C" });
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);
      store.insertEdge({
        id: generateId("edge"),
        from: n1.id,
        to: n2.id,
        relationType: "depends_on",
        createdAt: now(),
      });
      store.insertEdge({
        id: generateId("edge"),
        from: n3.id,
        to: n1.id,
        relationType: "blocks",
        createdAt: now(),
      });

      const from = store.getEdgesFrom(n1.id);
      expect(from).toHaveLength(1);
      expect(from[0].relationType).toBe("depends_on");

      const to = store.getEdgesTo(n1.id);
      expect(to).toHaveLength(1);
      expect(to[0].relationType).toBe("blocks");

      const both = [...store.getEdgesFrom(n1.id), ...store.getEdgesTo(n1.id)];
      expect(both).toHaveLength(2);
    });

    it("filters by relationType", () => {
      store.initProject();
      const n1 = makeNode({ title: "A" });
      const n2 = makeNode({ title: "B" });
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertEdge({
        id: generateId("edge"),
        from: n1.id,
        to: n2.id,
        relationType: "depends_on",
        createdAt: now(),
      });
      store.insertEdge({
        id: generateId("edge"),
        from: n1.id,
        to: n2.id,
        relationType: "blocks",
        createdAt: now(),
      });

      const filtered = store.getAllEdges().filter((e) => e.relationType === "depends_on");
      expect(filtered).toHaveLength(1);
    });
  });

  // ── list_snapshots tool ────────────────────

  describe("list_snapshots", () => {
    it("returns empty list when no snapshots", () => {
      store.initProject();
      const snapshots = store.listSnapshots();
      expect(snapshots).toHaveLength(0);
    });

    it("lists created snapshots in descending order", () => {
      store.initProject();
      const id1 = store.createSnapshot();
      const id2 = store.createSnapshot();

      const snapshots = store.listSnapshots();
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].snapshotId).toBe(id2);
      expect(snapshots[1].snapshotId).toBe(id1);
    });
  });

  // ── export_graph tool ──────────────────────

  describe("export_graph", () => {
    it("exports complete graph document", () => {
      store.initProject("Export Test");
      store.insertNode(makeNode({ title: "Node 1" }));
      store.insertNode(makeNode({ title: "Node 2" }));

      const doc = store.toGraphDocument();
      expect(doc.version).toBe("1.0.0");
      expect(doc.project.name).toBe("Export Test");
      expect(doc.nodes).toHaveLength(2);
    });
  });

  // ── move_node tool ─────────────────────────

  describe("move_node", () => {
    it("moves a node to a new parent", () => {
      store.initProject();
      const parent1 = makeNode({ type: "epic", title: "Parent 1" });
      const parent2 = makeNode({ type: "epic", title: "Parent 2" });
      const child = makeNode({ parentId: parent1.id, title: "Child" });
      store.insertNode(parent1);
      store.insertNode(parent2);
      store.insertNode(child);

      store.updateNode(child.id, { parentId: parent2.id });
      const updated = store.getNodeById(child.id);
      expect(updated!.parentId).toBe(parent2.id);
    });

    it("moves a node to root (null parent)", () => {
      store.initProject();
      const parent = makeNode({ type: "epic", title: "Parent" });
      const child = makeNode({ parentId: parent.id, title: "Child" });
      store.insertNode(parent);
      store.insertNode(child);

      store.updateNode(child.id, { parentId: null });
      const updated = store.getNodeById(child.id);
      expect(updated!.parentId).toBeUndefined();
    });
  });

  // ── clone_node tool ────────────────────────

  describe("clone_node", () => {
    it("clones a single node with reset status", () => {
      store.initProject();
      const original = makeNode({
        title: "Original",
        status: "done",
        priority: 1,
        tags: ["tag1"],
      });
      store.insertNode(original);

      const clone: GraphNode = {
        id: generateId("node"),
        type: original.type,
        title: original.title,
        status: "backlog",
        priority: original.priority,
        tags: original.tags ? [...original.tags] : undefined,
        createdAt: now(),
        updatedAt: now(),
      };
      store.insertNode(clone);

      const retrieved = store.getNodeById(clone.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe("Original");
      expect(retrieved!.status).toBe("backlog");
      expect(retrieved!.id).not.toBe(original.id);
    });

    it("deep clones node with children", () => {
      store.initProject();
      const parent = makeNode({ type: "epic", title: "Epic" });
      const child1 = makeNode({ parentId: parent.id, title: "Child 1" });
      const child2 = makeNode({ parentId: parent.id, title: "Child 2" });
      store.insertNode(parent);
      store.insertNode(child1);
      store.insertNode(child2);

      // Simulate deep clone
      const clonedParent = makeNode({ type: "epic", title: "Epic" });
      store.insertNode(clonedParent);
      const clonedChild1 = makeNode({ parentId: clonedParent.id, title: "Child 1" });
      const clonedChild2 = makeNode({ parentId: clonedParent.id, title: "Child 2" });
      store.insertNode(clonedChild1);
      store.insertNode(clonedChild2);

      const children = store.getChildNodes(clonedParent.id);
      expect(children).toHaveLength(2);
      expect(store.getAllNodes()).toHaveLength(6); // 3 original + 3 clones
    });
  });

  // ── Error: project not initialized ─────────

  describe("errors", () => {
    it("throws when accessing nodes without init", () => {
      expect(() => store.getAllNodes()).toThrow("Graph not initialized");
    });

    it("throws when inserting node without init", () => {
      expect(() => store.insertNode(makeNode())).toThrow("Graph not initialized");
    });
  });
});
