import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexPrdContent } from "../core/rag/prd-indexer.js";

describe("indexPrdContent", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("PRD Indexer Test");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  it("should index PRD content into knowledge store", () => {
    const result = indexPrdContent(
      knowledgeStore,
      "As a user, I want to search tasks so that I can find relevant work items.",
      "requirements.md",
    );

    expect(result.documentsIndexed).toBe(1);
    expect(result.sourceFile).toBe("requirements.md");
    expect(knowledgeStore.count("prd")).toBe(1);
  });

  it("should store phase metadata", () => {
    indexPrdContent(
      knowledgeStore,
      "User story for search feature",
      "requirements.md",
      "ANALYZE",
    );

    const docs = knowledgeStore.list({ sourceType: "prd" });
    expect(docs).toHaveLength(1);
    expect(docs[0].metadata).toMatchObject({
      sourceFile: "requirements.md",
      phase: "ANALYZE",
    });
  });

  it("should chunk large PRD content", () => {
    // Create a long PRD with ~3000 tokens worth of content
    const longContent = Array.from({ length: 100 }, (_, i) =>
      `Requirement ${i}: The system shall provide feature ${i} with full authentication and authorization support. `,
    ).join("\n");

    const result = indexPrdContent(knowledgeStore, longContent, "big-prd.md");

    expect(result.documentsIndexed).toBeGreaterThan(1);
    expect(knowledgeStore.count("prd")).toBeGreaterThan(1);
  });

  it("should be searchable via FTS after indexing", () => {
    indexPrdContent(
      knowledgeStore,
      "The system must support GraphQL queries for task management with real-time subscriptions.",
      "api-requirements.md",
    );

    const results = knowledgeStore.search("GraphQL");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sourceType).toBe("prd");
  });

  it("should re-index on duplicate source file (replace)", () => {
    indexPrdContent(knowledgeStore, "Version 1 content", "spec.md");
    expect(knowledgeStore.count("prd")).toBe(1);

    indexPrdContent(knowledgeStore, "Version 2 updated content", "spec.md");
    expect(knowledgeStore.count("prd")).toBe(1);

    const docs = knowledgeStore.list({ sourceType: "prd" });
    expect(docs[0].content).toContain("Version 2");
  });

  it("should return zero for empty content", () => {
    const result = indexPrdContent(knowledgeStore, "", "empty.md");
    expect(result.documentsIndexed).toBe(0);
  });

  it("should default phase to ANALYZE when not provided", () => {
    indexPrdContent(knowledgeStore, "Some requirement text", "req.md");

    const docs = knowledgeStore.list({ sourceType: "prd" });
    expect(docs[0].metadata).toMatchObject({ phase: "ANALYZE" });
  });
});
