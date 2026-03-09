import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { searchNodes } from "../core/search/fts-search.js";
import { tokenize } from "../core/search/tokenizer.js";
import { TfIdfIndex, rerankWithTfIdf } from "../core/search/tfidf.js";
import { makeNode } from "./helpers/factories.js";

// ── Tokenizer ─────────────────────────────────────

describe("tokenizer", () => {
  it("lowercases and strips accents", () => {
    const tokens = tokenize("Implementação Rápida");
    expect(tokens).toContain("implementacao");
    expect(tokens).toContain("rapida");
  });

  it("removes stopwords", () => {
    const tokens = tokenize("the quick brown fox");
    expect(tokens).not.toContain("the");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
    expect(tokens).toContain("fox");
  });

  it("handles empty input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });

  it("removes short tokens (< 2 chars)", () => {
    const tokens = tokenize("a b cd ef");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("b");
    expect(tokens).toContain("cd");
    expect(tokens).toContain("ef");
  });
});

// ── TF-IDF ────────────────────────────────────────

describe("TfIdfIndex", () => {
  it("ranks matching documents", () => {
    const index = new TfIdfIndex();
    index.addDocument("a", "parser text processing");
    index.addDocument("b", "database storage engine");
    index.addDocument("c", "parser engine advanced");

    const results = index.search("parser");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("a"); // "parser" appears fully in "a"
  });

  it("returns empty for no match", () => {
    const index = new TfIdfIndex();
    index.addDocument("a", "hello world");
    expect(index.search("xyz")).toEqual([]);
  });

  it("respects limit", () => {
    const index = new TfIdfIndex();
    for (let i = 0; i < 20; i++) {
      index.addDocument(`doc${i}`, `term${i} common`);
    }
    const results = index.search("common", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });
});

describe("rerankWithTfIdf", () => {
  it("reranks candidates", () => {
    const candidates = [
      { id: "1", text: "database storage SQL" },
      { id: "2", text: "parser PRD text analysis" },
      { id: "3", text: "parser module" },
    ];
    const results = rerankWithTfIdf(candidates, "parser PRD", 10);
    expect(results.length).toBeGreaterThan(0);
    // Document 2 should rank highest — it contains both "parser" and "PRD"
    expect(results[0].id).toBe("2");
  });
});

// ── FTS Search (integration) ──────────────────────

describe("searchNodes (FTS5)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Search Test");
  });

  afterEach(() => {
    store.close();
  });

  it("finds nodes by title match", () => {
    store.insertNode(makeNode({ title: "Implement parser module" }));
    store.insertNode(makeNode({ title: "Create database schema" }));
    store.insertNode(makeNode({ title: "Build API layer" }));

    const results = searchNodes(store, "parser");
    expect(results).toHaveLength(1);
    expect(results[0].node.title).toContain("parser");
  });

  it("finds nodes by description match", () => {
    store.insertNode(
      makeNode({
        title: "Task A",
        description: "This task involves building a robust parser for PRD files",
      }),
    );
    store.insertNode(makeNode({ title: "Task B", description: "Database work" }));

    const results = searchNodes(store, "parser PRD");
    expect(results).toHaveLength(1);
    expect(results[0].node.title).toBe("Task A");
  });

  it("returns empty for no match", () => {
    store.insertNode(makeNode({ title: "Hello world" }));
    const results = searchNodes(store, "nonexistent");
    expect(results).toHaveLength(0);
  });

  it("respects limit", () => {
    for (let i = 0; i < 10; i++) {
      store.insertNode(makeNode({ title: `Parser task ${i}` }));
    }
    const results = searchNodes(store, "parser", { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("supports reranking option", () => {
    store.insertNode(makeNode({ title: "Parser core", description: "Main parser implementation" }));
    store.insertNode(makeNode({ title: "Parser utils", description: "Helper functions" }));

    const results = searchNodes(store, "parser", { rerank: true });
    expect(results.length).toBeGreaterThan(0);
  });

  it("handles special characters in query", () => {
    store.insertNode(makeNode({ title: "Test node" }));
    // Should not throw
    const results = searchNodes(store, 'test "AND" OR (NOT)');
    expect(results).toHaveLength(1);
  });
});
