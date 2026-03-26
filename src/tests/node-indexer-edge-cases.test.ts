import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { makeNode } from "./helpers/factories.js";
import { indexNodeAsKnowledge, removeNodeFromKnowledge, indexAllNodes } from "../core/rag/node-indexer.js";

let store: SqliteStore;
let ks: KnowledgeStore;

beforeEach(() => {
  store = SqliteStore.open(":memory:");
  store.initProject("Edge Cases Test");
  ks = new KnowledgeStore(store.getDb());
});

afterEach(() => {
  store.close();
});

describe("node-indexer edge cases", () => {
  it("should handle node with empty title", () => {
    // Arrange
    const node = makeNode({ title: "" });
    store.insertNode(node);

    // Act & Assert — should not throw
    expect(() => indexNodeAsKnowledge(store.getDb(), node)).not.toThrow();

    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
  });

  it("should handle very long description (10000 chars)", () => {
    // Arrange
    const filler = "lorem ipsum dolor sit amet ".repeat(400);
    const uniqueTerm = "xyzuniquemarker";
    const longDesc = filler.slice(0, 5000) + " " + uniqueTerm + " " + filler.slice(0, 5000 - uniqueTerm.length - 2);
    expect(longDesc.length).toBeGreaterThanOrEqual(10000);
    const node = makeNode({ description: longDesc });
    store.insertNode(node);

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const results = ks.search(uniqueTerm);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sourceId).toBe(node.id);
  });

  it("should handle Unicode content", () => {
    // Arrange
    const node = makeNode({
      title: "Implementar busca com acentuação e émojis 🚀",
      description: "数据库连接 — conexão com banco de dados",
    });
    store.insertNode(node);

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const results = ks.search("acentuação");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sourceId).toBe(node.id);
  });

  it("should handle FTS special characters in title", () => {
    // Arrange
    const node = makeNode({ title: '"quotes" AND OR NOT * -prefix' });
    store.insertNode(node);

    // Act & Assert — should not throw
    expect(() => indexNodeAsKnowledge(store.getDb(), node)).not.toThrow();

    // Verify doc was stored (don't use FTS search with special chars)
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe('"quotes" AND OR NOT * -prefix');
  });

  it("should handle HTML in description", () => {
    // Arrange
    const htmlContent = "<script>alert('xss')</script><b>bold</b>";
    const node = makeNode({ description: htmlContent });
    store.insertNode(node);

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert — content stored as-is
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("<script>alert('xss')</script>");
  });

  it("should handle concurrent indexing of same node", () => {
    // Arrange
    const node = makeNode({ title: "Duplicate indexing test" });
    store.insertNode(node);

    // Act — index the same node twice rapidly
    indexNodeAsKnowledge(store.getDb(), node);
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert — exactly 1 doc exists (second call replaces the first)
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
  });

  it("should handle node with 100+ tags", () => {
    // Arrange
    const tags = Array.from({ length: 150 }, (_, i) => "tag-" + i);
    const node = makeNode({ tags });
    store.insertNode(node);

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("tag-0");
    expect(docs[0].content).toContain("tag-149");
  });

  it("should handle AC with special characters", () => {
    // Arrange
    const ac = [
      "Check | pipe works",
      "Verify `backtick` code",
      "Test [brackets] ok",
    ];
    const node = makeNode({ acceptanceCriteria: ac });
    store.insertNode(node);

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("Check | pipe works");
    expect(docs[0].content).toContain("Verify `backtick` code");
    expect(docs[0].content).toContain("Test [brackets] ok");
  });

  it("should handle node with null parentId and undefined description", () => {
    // Arrange
    const node = makeNode({ parentId: null as unknown as undefined, description: undefined });
    store.insertNode(node);

    // Act
    indexNodeAsKnowledge(store.getDb(), node);

    // Assert
    const docs = ks.getBySourceId(node.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).not.toContain("undefined");
  });

  it("should skip corrupted rows and continue indexing valid nodes", () => {
    // Arrange — insert a row directly with corrupted JSON in tags
    const db = store.getDb();
    const project = store.getActiveProject()!;
    const timestamp = new Date().toISOString();

    db.prepare(
      `INSERT INTO nodes
        (id, project_id, type, title, description, status, priority, tags,
         acceptance_criteria, parent_id, blocked, created_at, updated_at)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "corrupted-node-001",
      project.id,
      "task",
      "Corrupted tags node",
      "Some description",
      "backlog",
      3,
      "{invalid",           // corrupted JSON
      "[]",
      null,
      0,
      timestamp,
      timestamp,
    );

    // Also insert a valid node
    const validNode = makeNode({ title: "Valid node after corrupted" });
    store.insertNode(validNode);

    // Act — should NOT throw, should skip corrupted row and continue
    const result = indexAllNodes(db);

    // Assert — corrupted row skipped, valid node indexed
    expect(result.indexed).toBeGreaterThanOrEqual(1);
    const docs = ks.getBySourceId(validNode.id);
    expect(docs).toHaveLength(1);
  });
});
