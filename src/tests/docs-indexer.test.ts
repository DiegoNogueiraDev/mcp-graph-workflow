import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { DocsCacheStore } from "../core/docs/docs-cache-store.js";
import { indexCachedDocs } from "../core/rag/docs-indexer.js";

describe("DocsIndexer", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;
  let docsCacheStore: DocsCacheStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
    docsCacheStore = new DocsCacheStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should return zeros when no cached docs exist", () => {
    const result = indexCachedDocs(knowledgeStore, docsCacheStore);

    expect(result.docsFound).toBe(0);
    expect(result.documentsIndexed).toBe(0);
  });

  it("should index cached docs into knowledge store", () => {
    docsCacheStore.upsertDoc({
      libId: "express/express",
      libName: "express",
      content: "Express web framework documentation",
    });
    docsCacheStore.upsertDoc({
      libId: "react/react",
      libName: "react",
      content: "React component library documentation",
    });

    const result = indexCachedDocs(knowledgeStore, docsCacheStore);

    expect(result.docsFound).toBe(2);
    expect(result.documentsIndexed).toBe(2);
    expect(knowledgeStore.count("docs")).toBe(2);
  });

  it("should chunk large docs", () => {
    docsCacheStore.upsertDoc({
      libId: "big/lib",
      libName: "big-lib",
      content: "Documentation paragraph about the library. ".repeat(200),
    });

    const result = indexCachedDocs(knowledgeStore, docsCacheStore);

    expect(result.docsFound).toBe(1);
    expect(knowledgeStore.count("docs")).toBeGreaterThan(1);
  });

  it("should store lib metadata", () => {
    docsCacheStore.upsertDoc({
      libId: "zod/zod",
      libName: "zod",
      version: "4.0",
      content: "Zod schema validation library",
    });

    indexCachedDocs(knowledgeStore, docsCacheStore);

    const docs = knowledgeStore.list({ sourceType: "docs" });
    expect(docs[0].metadata?.libId).toBe("zod/zod");
    expect(docs[0].metadata?.version).toBe("4.0");
  });

  it("should replace previous index on re-run", () => {
    docsCacheStore.upsertDoc({
      libId: "express/express",
      libName: "express",
      content: "Express v4 docs",
    });

    indexCachedDocs(knowledgeStore, docsCacheStore);
    const countFirst = knowledgeStore.count("docs");

    // Update the cached doc
    docsCacheStore.upsertDoc({
      libId: "express/express",
      libName: "express",
      content: "Express v5 updated docs",
    });

    indexCachedDocs(knowledgeStore, docsCacheStore);
    const countSecond = knowledgeStore.count("docs");

    // Should have same count (replaced, not duplicated)
    expect(countSecond).toBe(countFirst);

    // Verify updated content
    const docs = knowledgeStore.list({ sourceType: "docs" });
    expect(docs[0].content).toContain("v5");
  });

  it("should make docs searchable via FTS", () => {
    docsCacheStore.upsertDoc({
      libId: "vitest/vitest",
      libName: "vitest",
      content: "Vitest is a testing framework powered by Vite",
    });

    indexCachedDocs(knowledgeStore, docsCacheStore);

    const results = knowledgeStore.search("testing framework");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toBe("vitest");
  });
});
