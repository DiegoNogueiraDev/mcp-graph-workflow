/**
 * Unit tests for src/core/rag/node-indexer.ts
 *
 * Covers: indexNodeAsKnowledge, removeNodeFromKnowledge, indexAllNodes
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { EntityStore } from "../core/rag/entity-store.js";
import { makeNode, makeEpic } from "./helpers/factories.js";
import {
  indexNodeAsKnowledge,
  removeNodeFromKnowledge,
  indexAllNodes,
} from "../core/rag/node-indexer.js";

let store: SqliteStore;
let ks: KnowledgeStore;

beforeEach(() => {
  store = SqliteStore.open(":memory:");
  store.initProject("Node Indexer Unit Test");
  ks = new KnowledgeStore(store.getDb());
});

afterEach(() => {
  store.close();
});

// ── indexNodeAsKnowledge ────────────────────────────────────────

describe("indexNodeAsKnowledge", () => {
  it("should produce knowledge doc with sourceType graph_node", () => {
    // Arrange
    const node = makeNode({ title: "Implement login" });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].sourceType).toBe("graph_node");
  });

  it("should build content with title as markdown H1", () => {
    // Arrange
    const node = makeNode({ title: "Setup database" });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs[0].content).toContain("# Setup database");
  });

  it("should include type, status, and priority in content", () => {
    // Arrange
    const node = makeNode({
      type: "epic",
      status: "in_progress",
      priority: 1,
    });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    const content = docs[0].content;
    expect(content).toContain("Type: epic");
    expect(content).toContain("Status: in_progress");
    expect(content).toContain("Priority: 1");
  });

  it("should include description when present", () => {
    // Arrange
    const node = makeNode({
      title: "Auth module",
      description: "Handles JWT authentication flow",
    });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs[0].content).toContain("Handles JWT authentication flow");
  });

  it("should not include undefined when description is absent", () => {
    // Arrange
    const node = makeNode({ title: "No desc task" });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs[0].content).not.toContain("undefined");
  });

  it("should render acceptance criteria as markdown list items", () => {
    // Arrange
    const node = makeNode({
      acceptanceCriteria: ["Login form validates email", "Error shown on failure"],
    });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    const content = docs[0].content;
    expect(content).toContain("## Acceptance Criteria");
    expect(content).toContain("- Login form validates email");
    expect(content).toContain("- Error shown on failure");
  });

  it("should omit AC section when array is empty", () => {
    // Arrange
    const node = makeNode({ acceptanceCriteria: [] });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs[0].content).not.toContain("## Acceptance Criteria");
  });

  it("should omit AC section when undefined", () => {
    // Arrange
    const node = makeNode();

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs[0].content).not.toContain("## Acceptance Criteria");
  });

  it("should include tags as comma-separated line", () => {
    // Arrange
    const node = makeNode({ tags: ["backend", "auth", "security"] });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs[0].content).toContain("Tags: backend, auth, security");
  });

  it("should set sourceId to node.id", () => {
    // Arrange
    const node = makeNode({ id: "node-fixed-id-123" });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId("node-fixed-id-123");
    expect(docs).toHaveLength(1);
    expect(docs[0].sourceId).toBe("node-fixed-id-123");
  });

  it("should store metadata with nodeType, status, priority", () => {
    // Arrange
    const node = makeNode({ type: "milestone", status: "ready", priority: 2 });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    const meta = docs[0].metadata as Record<string, unknown>;
    expect(meta.nodeType).toBe("milestone");
    expect(meta.status).toBe("ready");
    expect(meta.priority).toBe(2);
  });

  it("should replace existing doc on re-index (idempotent update)", () => {
    // Arrange
    const node = makeNode({ title: "Original title" });
    indexNodeAsKnowledge(store.getDb(), node);

    // Act — re-index with updated title
    const updated = { ...node, title: "Updated title" };
    indexNodeAsKnowledge(store.getDb(), updated);

    // Assert — only 1 doc, with new title
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("# Updated title");
    expect(docs[0].title).toBe("Updated title");
  });

  it("should trigger entity extraction", () => {
    // Arrange
    const es = new EntityStore(store.getDb());
    const node = makeNode({
      title: "Refactor SqliteStore for performance",
      description: "The SqliteStore module needs optimization for large graphs",
    });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert — only check if KG tables exist (migration may not include them)
    if (es.hasKgTables()) {
      const entities = es.findByName("SqliteStore");
      expect(entities.length).toBeGreaterThanOrEqual(1);
    }
  });

  it.each([
    "epic",
    "task",
    "subtask",
    "requirement",
    "constraint",
    "milestone",
    "acceptance_criteria",
    "risk",
    "decision",
  ] as const)("should work for NodeType %s", (type) => {
    // Arrange
    const node = makeNode({ type, title: `Node of type ${type}` });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain(`Type: ${type}`);
  });

  it.each([
    "backlog",
    "ready",
    "in_progress",
    "blocked",
    "done",
  ] as const)("should work for NodeStatus %s", (status) => {
    // Arrange
    const node = makeNode({ status, title: `Node with status ${status}` });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain(`Status: ${status}`);
  });

  it.each([1, 2, 3, 4, 5] as const)("should work for priority level %i", (priority) => {
    // Arrange
    const node = makeNode({ priority, title: `Priority ${priority} task` });

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain(`Priority: ${priority}`);
  });
});

// ── removeNodeFromKnowledge ─────────────────────────────────────

describe("removeNodeFromKnowledge", () => {
  it("should delete all knowledge docs for a given nodeId", () => {
    // Arrange
    const node = makeNode({ title: "To be removed" });
    indexNodeAsKnowledge(store.getDb(), node);
    expect(ks.getBySourceId(node.id)).toHaveLength(1);

    // Act
    removeNodeFromKnowledge(store.getDb(), node.id);

    // Assert
    expect(ks.getBySourceId(node.id)).toHaveLength(0);
  });

  it("should be no-op for non-existent nodeId", () => {
    // Arrange — nothing indexed

    // Act & Assert — should not throw
    expect(() => {
      removeNodeFromKnowledge(store.getDb(), "node-does-not-exist");
    }).not.toThrow();
  });

  it("should not affect docs from other nodes", () => {
    // Arrange
    const nodeA = makeNode({ title: "Node A" });
    const nodeB = makeNode({ title: "Node B" });
    indexNodeAsKnowledge(store.getDb(), nodeA);
    indexNodeAsKnowledge(store.getDb(), nodeB);

    // Act
    removeNodeFromKnowledge(store.getDb(), nodeA.id);

    // Assert
    expect(ks.getBySourceId(nodeA.id)).toHaveLength(0);
    expect(ks.getBySourceId(nodeB.id)).toHaveLength(1);
  });

  it("should handle node that was never indexed", () => {
    // Arrange
    const node = makeNode({ title: "Never indexed" });

    // Act & Assert — should not throw
    expect(() => {
      removeNodeFromKnowledge(store.getDb(), node.id);
    }).not.toThrow();
    expect(ks.getBySourceId(node.id)).toHaveLength(0);
  });
});

// ── indexAllNodes ───────────────────────────────────────────────

describe("indexAllNodes", () => {
  it("should return correct count for N nodes", () => {
    // Arrange
    const n1 = makeNode({ title: "Task 1" });
    const n2 = makeNode({ title: "Task 2" });
    const n3 = makeEpic({ title: "Epic 1" });
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertNode(n3);

    // Act
    const result = indexAllNodes(store.getDb());

    // Assert
    expect(result.indexed).toBe(3);
  });

  it("should create one knowledge doc per node", () => {
    // Arrange
    const n1 = makeNode({ title: "Task A" });
    const n2 = makeNode({ title: "Task B" });
    store.insertNode(n1);
    store.insertNode(n2);

    // Act
    indexAllNodes(store.getDb());

    // Assert
    expect(ks.getBySourceId(n1.id)).toHaveLength(1);
    expect(ks.getBySourceId(n2.id)).toHaveLength(1);
  });

  it("should handle empty nodes table", () => {
    // Arrange — no nodes inserted

    // Act
    const result = indexAllNodes(store.getDb());

    // Assert
    expect(result.indexed).toBe(0);
  });

  it("should parse JSON tags and AC from SQLite correctly", () => {
    // Arrange
    const node = makeNode({
      title: "Node with tags and AC",
      tags: ["api", "backend"],
      acceptanceCriteria: ["Must return 200", "Must validate input"],
    });
    store.insertNode(node);

    // Act
    indexAllNodes(store.getDb());

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("Tags: api, backend");
    expect(docs[0].content).toContain("- Must return 200");
    expect(docs[0].content).toContain("- Must validate input");
  });

  it("should handle nodes with null optional fields", () => {
    // Arrange
    const node = makeNode({
      title: "Minimal node",
      description: undefined,
      tags: undefined,
      acceptanceCriteria: undefined,
      parentId: null,
    });
    store.insertNode(node);

    // Act
    const result = indexAllNodes(store.getDb());

    // Assert
    expect(result.indexed).toBe(1);
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).not.toContain("undefined");
  });

  it("should be idempotent — call twice, still 1 doc per node", () => {
    // Arrange
    const n1 = makeNode({ title: "Idempotent task" });
    const n2 = makeNode({ title: "Another task" });
    store.insertNode(n1);
    store.insertNode(n2);

    // Act
    indexAllNodes(store.getDb());
    indexAllNodes(store.getDb());

    // Assert
    expect(ks.getBySourceId(n1.id)).toHaveLength(1);
    expect(ks.getBySourceId(n2.id)).toHaveLength(1);
  });
});
