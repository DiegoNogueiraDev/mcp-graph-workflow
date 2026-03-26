/**
 * Integration tests: MCP tool → node-indexer → KnowledgeStore → FTS flow.
 * Verifies that graph nodes indexed via node-indexer become discoverable
 * through KnowledgeStore search (FTS5 + BM25).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { makeNode, makeEpic } from "./helpers/factories.js";
import {
  indexNodeAsKnowledge,
  removeNodeFromKnowledge,
  indexAllNodes,
} from "../core/rag/node-indexer.js";
import { generateId } from "../core/utils/id.js";

let store: SqliteStore;
let ks: KnowledgeStore;

beforeEach(() => {
  store = SqliteStore.open(":memory:");
  store.initProject("MCP Integration Test");
  ks = new KnowledgeStore(store.getDb());
});

afterEach(() => {
  store.close();
});

// ---------------------------------------------------------------------------
// Node tool integration
// ---------------------------------------------------------------------------
describe("Node tool integration", () => {
  it("should make node searchable via FTS after indexing", () => {
    // Arrange
    const node = makeNode({ title: "Authentication middleware" });
    store.insertNode(node);

    // Act
    indexNodeAsKnowledge(store.getDb(), node);
    const results = ks.search("Authentication middleware", 10);

    // Assert
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sourceType).toBe("graph_node");
    expect(results[0].sourceId).toBe(node.id);
  });

  it("should replace knowledge doc when node title is updated", () => {
    // Arrange
    const node = makeNode({ title: "Old Title" });
    store.insertNode(node);
    indexNodeAsKnowledge(store.getDb(), node);

    // Act — simulate update
    const updatedNode = { ...node, title: "New Title" };
    indexNodeAsKnowledge(store.getDb(), updatedNode);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe("New Title");

    const searchResults = ks.search("New Title", 10);
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults[0].sourceId).toBe(node.id);
  });

  it("should remove node from knowledge when deleted", () => {
    // Arrange
    const node = makeNode({ title: "Ephemeral feature" });
    store.insertNode(node);
    indexNodeAsKnowledge(store.getDb(), node);

    // Act
    removeNodeFromKnowledge(store.getDb(), node.id);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(0);

    const searchResults = ks.search("Ephemeral feature", 10);
    expect(searchResults).toHaveLength(0);
  });

  it("should leave clean state after rapid add-update-delete cycle", () => {
    // Arrange
    const node = makeNode({ title: "Cycle test v0" });
    store.insertNode(node);
    indexNodeAsKnowledge(store.getDb(), node);

    // Act — 3 title updates
    indexNodeAsKnowledge(store.getDb(), { ...node, title: "Cycle test v1" });
    indexNodeAsKnowledge(store.getDb(), { ...node, title: "Cycle test v2" });
    indexNodeAsKnowledge(store.getDb(), { ...node, title: "Cycle test v3" });

    // Delete
    removeNodeFromKnowledge(store.getDb(), node.id);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Clone node integration
// ---------------------------------------------------------------------------
describe("Clone node integration", () => {
  it("should index both original and shallow clone", () => {
    // Arrange
    const original = makeNode({ title: "Original auth service" });
    store.insertNode(original);
    indexNodeAsKnowledge(store.getDb(), original);

    // Act — simulate shallow clone
    const clone = makeNode({
      id: generateId("node"),
      title: original.title,
      description: original.description,
      type: original.type,
      status: original.status,
      priority: original.priority,
    });
    store.insertNode(clone);
    indexNodeAsKnowledge(store.getDb(), clone);

    // Assert
    const allDocs = ks.list({ sourceType: "graph_node" });
    expect(allDocs).toHaveLength(2);

    const originalDocs = ks.getBySourceId(original.id);
    expect(originalDocs).toHaveLength(1);

    const cloneDocs = ks.getBySourceId(clone.id);
    expect(cloneDocs).toHaveLength(1);
  });

  it("should index all cloned children in a deep clone", () => {
    // Arrange — epic + 3 children
    const epic = makeEpic({ title: "Payment epic" });
    store.insertNode(epic);
    indexNodeAsKnowledge(store.getDb(), epic);

    const children = Array.from({ length: 3 }, (_, i) =>
      makeNode({ title: `Payment task ${i + 1}`, parentId: epic.id }),
    );
    for (const child of children) {
      store.insertNode(child);
      indexNodeAsKnowledge(store.getDb(), child);
    }

    // Act — deep clone: new IDs, same content
    const clonedEpic = makeEpic({ id: generateId("node"), title: epic.title });
    store.insertNode(clonedEpic);
    indexNodeAsKnowledge(store.getDb(), clonedEpic);

    const clonedChildren = children.map((child) =>
      makeNode({
        id: generateId("node"),
        title: child.title,
        parentId: clonedEpic.id,
      }),
    );
    for (const clone of clonedChildren) {
      store.insertNode(clone);
      indexNodeAsKnowledge(store.getDb(), clone);
    }

    // Assert — 4 originals + 4 clones = 8
    const allDocs = ks.list({ sourceType: "graph_node" });
    expect(allDocs).toHaveLength(8);
  });

  it("should keep cloned node knowledge independent from original", () => {
    // Arrange
    const original = makeNode({ title: "Shared service logic" });
    store.insertNode(original);
    indexNodeAsKnowledge(store.getDb(), original);

    const clone = makeNode({
      id: generateId("node"),
      title: original.title,
      type: original.type,
      status: original.status,
      priority: original.priority,
    });
    store.insertNode(clone);
    indexNodeAsKnowledge(store.getDb(), clone);

    // Act — update original title only
    indexNodeAsKnowledge(store.getDb(), {
      ...original,
      title: "Updated service logic",
    });

    // Assert — clone retains original title
    const cloneDocs = ks.getBySourceId(clone.id);
    expect(cloneDocs).toHaveLength(1);
    expect(cloneDocs[0].title).toBe("Shared service logic");

    const originalDocs = ks.getBySourceId(original.id);
    expect(originalDocs).toHaveLength(1);
    expect(originalDocs[0].title).toBe("Updated service logic");
  });
});

// ---------------------------------------------------------------------------
// Import graph integration
// ---------------------------------------------------------------------------
describe("Import graph integration", () => {
  it("should index all new nodes via indexAllNodes", () => {
    // Arrange
    const nodes = [
      makeNode({ title: "Import task alpha" }),
      makeNode({ title: "Import task beta" }),
      makeNode({ title: "Import task gamma" }),
    ];
    for (const node of nodes) {
      store.insertNode(node);
    }

    // Act
    const result = indexAllNodes(store.getDb());

    // Assert
    expect(result.indexed).toBe(3);
    const allDocs = ks.list({ sourceType: "graph_node" });
    expect(allDocs).toHaveLength(3);
  });

  it("should not create docs when no nodes exist", () => {
    // Act
    const result = indexAllNodes(store.getDb());

    // Assert
    expect(result.indexed).toBe(0);
    const allDocs = ks.list({ sourceType: "graph_node" });
    expect(allDocs).toHaveLength(0);
  });

  it("should not duplicate docs on re-import", () => {
    // Arrange
    const nodes = [
      makeNode({ title: "Reimport task one" }),
      makeNode({ title: "Reimport task two" }),
      makeNode({ title: "Reimport task three" }),
    ];
    for (const node of nodes) {
      store.insertNode(node);
    }

    // Act — index twice
    indexAllNodes(store.getDb());
    indexAllNodes(store.getDb());

    // Assert — each node still has exactly 1 doc
    for (const node of nodes) {
      const docs = ks.getBySourceId(node.id);
      expect(docs).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Reindex knowledge integration
// ---------------------------------------------------------------------------
describe("Reindex knowledge integration", () => {
  it("should index all existing nodes that were never individually indexed", () => {
    // Arrange — 5 nodes inserted without calling indexNodeAsKnowledge
    const nodes = Array.from({ length: 5 }, (_, i) =>
      makeNode({ title: `Unindexed task ${i + 1}` }),
    );
    for (const node of nodes) {
      store.insertNode(node);
    }

    // Act
    const result = indexAllNodes(store.getDb());

    // Assert
    expect(result.indexed).toBe(5);
    const allDocs = ks.list({ sourceType: "graph_node" });
    expect(allDocs).toHaveLength(5);
  });

  it("should be idempotent when called multiple times", () => {
    // Arrange
    const nodes = [
      makeNode({ title: "Idempotent check A" }),
      makeNode({ title: "Idempotent check B" }),
      makeNode({ title: "Idempotent check C" }),
    ];
    for (const node of nodes) {
      store.insertNode(node);
    }

    // Act
    indexAllNodes(store.getDb());
    indexAllNodes(store.getDb());

    // Assert — 3 nodes × 1 doc each = 3 total
    const allDocs = ks.list({ sourceType: "graph_node" });
    expect(allDocs).toHaveLength(3);
  });

  it("should return zero indexed when graph is empty", () => {
    // Act
    const result = indexAllNodes(store.getDb());

    // Assert
    expect(result).toEqual({ indexed: 0 });
  });
});
