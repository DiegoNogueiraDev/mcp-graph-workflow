import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexSifContent } from "../../core/rag/siebel-indexer.js";
import { parseSifContent } from "../../core/siebel/sif-parser.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SAMPLE_SIF_PATH = resolve(import.meta.dirname, "../fixtures/sample.sif");
const SAMPLE_SIF_CONTENT = readFileSync(SAMPLE_SIF_PATH, "utf-8");

describe("siebel-indexer", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Siebel Indexer Test");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  describe("indexSifContent", () => {
    it("should index SIF objects into knowledge store", () => {
      const parseResult = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
      const result = indexSifContent(knowledgeStore, parseResult);

      expect(result.documentsIndexed).toBeGreaterThan(0);
      expect(result.sourceFile).toBe("sample.sif");
    });

    it("should create documents with sourceType siebel_sif", () => {
      const parseResult = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
      indexSifContent(knowledgeStore, parseResult);

      const count = knowledgeStore.count("siebel_sif");
      expect(count).toBeGreaterThan(0);
    });

    it("should be searchable after indexing", () => {
      const parseResult = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
      indexSifContent(knowledgeStore, parseResult);

      const results = knowledgeStore.search("Account", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should deduplicate on re-index", () => {
      const parseResult = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
      indexSifContent(knowledgeStore, parseResult);
      const firstCount = knowledgeStore.count("siebel_sif");

      // Re-index should delete old and insert fresh
      indexSifContent(knowledgeStore, parseResult);
      const secondCount = knowledgeStore.count("siebel_sif");

      expect(secondCount).toBe(firstCount);
    });

    it("should return zero for empty parse result", () => {
      const emptyResult = {
        metadata: {
          fileName: "empty.sif",
          objectCount: 0,
          objectTypes: [],
          extractedAt: new Date().toISOString(),
        },
        objects: [],
        dependencies: [],
      };

      const result = indexSifContent(knowledgeStore, emptyResult);
      expect(result.documentsIndexed).toBe(0);
    });
  });
});
