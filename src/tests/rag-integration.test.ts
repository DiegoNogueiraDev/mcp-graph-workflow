/**
 * Integration tests for the RAG pipeline — verifies that all modules
 * work together end-to-end:
 *
 * query-understanding → multiStrategySearch → postRetrievalPipeline →
 * buildCitedContext → RagTracer → QueryCache
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { understandQuery } from "../core/rag/query-understanding.js";
import { postRetrievalPipeline } from "../core/rag/post-retrieval.js";
import { buildCitedContext } from "../core/rag/citation-mapper.js";
import { QueryCache } from "../core/rag/query-cache.js";
import { RagTracer } from "../core/rag/rag-trace.js";
import { multiStrategySearch } from "../core/rag/multi-strategy-retrieval.js";
import type { RankedResult } from "../core/rag/multi-strategy-retrieval.js";
import { makeNode } from "./helpers/factories.js";

describe("RAG Pipeline Integration", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("RAG Test Project");
  });

  afterEach(() => {
    store.close();
  });

  describe("query-understanding → search pipeline", () => {
    it("should rewrite query and detect intent before search", () => {
      const understanding = understandQuery("how does the knowledge store handle deduplication?");

      expect(understanding.intent).toBe("how_to");
      expect(understanding.rewrittenQuery).toBeTruthy();
      expect(understanding.rewrittenQuery.length).toBeGreaterThan(0);
      // Should not contain stopwords like "does", "the"
      expect(understanding.rewrittenQuery).not.toContain("does");
    });

    it("should detect source filters from query", () => {
      const understanding = understandQuery("find all endpoints in the PRD");

      expect(understanding.sourceTypeFilter).toContain("prd");
    });

    it("should expand query with related terms", () => {
      const understanding = understandQuery("database migration");

      expect(understanding.expandedTerms.length).toBeGreaterThan(2);
      // "database" should expand to sqlite, store, migration, schema
      expect(understanding.expandedTerms).toEqual(
        expect.arrayContaining(["sqlite", "store"]),
      );
    });
  });

  describe("post-retrieval pipeline", () => {
    function makeRankedResult(overrides: Partial<RankedResult> & { id: string }): RankedResult {
      return {
        sourceType: "docs",
        sourceId: "src-1",
        title: "Test Doc",
        content: "Default content for testing.",
        score: 0.5,
        qualityScore: 0.7,
        strategies: ["fts"],
        ...overrides,
      };
    }

    it("should deduplicate and rerank search results", () => {
      const results: RankedResult[] = [
        makeRankedResult({ id: "a", content: "knowledge store query pipeline", score: 0.9 }),
        makeRankedResult({ id: "b", content: "knowledge store query pipeline", score: 0.7 }), // duplicate
        makeRankedResult({ id: "c", content: "unrelated topic here", score: 0.5 }),
      ];

      const processed = postRetrievalPipeline({
        query: "knowledge store",
        results,
        maxResults: 10,
      });

      expect(processed.results.length).toBeLessThan(results.length);
      expect(processed.deduplicated).toBeGreaterThan(0);
    });

    it("should respect maxResults after processing", () => {
      const results = Array.from({ length: 15 }, (_, i) =>
        makeRankedResult({ id: `r${i}`, content: `Unique content ${i}`, score: 1 - i * 0.01 }),
      );

      const processed = postRetrievalPipeline({
        query: "test",
        results,
        maxResults: 5,
      });

      expect(processed.results).toHaveLength(5);
    });
  });

  describe("citation mapper integration", () => {
    function makeRankedResult(overrides: Partial<RankedResult> & { id: string }): RankedResult {
      return {
        sourceType: "docs",
        sourceId: "src-1",
        title: "Test Doc",
        content: "Default content.",
        score: 0.5,
        qualityScore: 0.7,
        strategies: ["fts"],
        ...overrides,
      };
    }

    it("should produce cited context with [N] markers", () => {
      const results: RankedResult[] = [
        makeRankedResult({ id: "a", sourceType: "prd", content: "User should be able to import graphs." }),
        makeRankedResult({ id: "b", sourceType: "docs", content: "SqliteStore provides mergeInsert method." }),
      ];

      const cited = buildCitedContext(results);

      expect(cited.assembledText).toContain("[1]");
      expect(cited.assembledText).toContain("[2]");
      expect(cited.assembledText).toContain("import graphs");
      expect(cited.citations).toHaveLength(2);
      expect(cited.sourceBreakdown["prd"]).toBe(1);
      expect(cited.sourceBreakdown["docs"]).toBe(1);
    });

    it("should produce empty context for empty results", () => {
      const cited = buildCitedContext([]);

      expect(cited.assembledText).toBe("");
      expect(cited.citations).toHaveLength(0);
    });
  });

  describe("query cache integration", () => {
    function makeRankedResult(id: string): RankedResult {
      return {
        id,
        sourceType: "docs",
        sourceId: "src-1",
        title: "Cached Doc",
        content: "Cached content.",
        score: 0.8,
        qualityScore: 0.7,
        strategies: ["fts"],
      };
    }

    it("should cache results and return on second query", () => {
      const cache = new QueryCache({ ttlMs: 60000, maxSize: 10 });
      const results = [makeRankedResult("r1"), makeRankedResult("r2")];

      expect(cache.get("test query")).toBeUndefined();

      cache.set("test query", results);

      const cached = cache.get("test query");
      expect(cached).not.toBeUndefined();
      expect(cached).toHaveLength(2);
    });

    it("should normalize query keys (case-insensitive)", () => {
      const cache = new QueryCache({ ttlMs: 60000, maxSize: 10 });
      const results = [makeRankedResult("r1")];

      cache.set("Knowledge Store", results);

      expect(cache.get("knowledge store")).not.toBeUndefined();
      expect(cache.get("KNOWLEDGE STORE")).not.toBeUndefined();
    });

    it("should invalidate all entries", () => {
      const cache = new QueryCache({ ttlMs: 60000, maxSize: 10 });
      cache.set("query1", [makeRankedResult("r1")]);
      cache.set("query2", [makeRankedResult("r2")]);

      cache.invalidateAll();

      expect(cache.get("query1")).toBeUndefined();
      expect(cache.get("query2")).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe("RAG tracer integration", () => {
    it("should trace the full pipeline stages", () => {
      const tracer = new RagTracer("how does deduplication work?");

      // Stage 1: Query understanding
      tracer.startStage("query_understanding");
      const understanding = understandQuery("how does deduplication work?");
      tracer.endStage("query_understanding", {
        inputCount: 1,
        outputCount: 1,
        details: { intent: understanding.intent },
      });

      // Stage 2: Retrieval (simulate)
      tracer.startStage("retrieval");
      tracer.endStage("retrieval", { inputCount: 1, outputCount: 5 });

      // Stage 3: Post-retrieval (simulate)
      tracer.startStage("post_retrieval");
      tracer.endStage("post_retrieval", { inputCount: 5, outputCount: 3 });

      // Stage 4: Citation
      tracer.startStage("citation");
      tracer.endStage("citation", { inputCount: 3, outputCount: 3 });

      tracer.recordSourceContribution("prd", 2);
      tracer.recordSourceContribution("docs", 1);
      tracer.setCitationCount(3);
      tracer.setTokensUsed(450);

      const trace = tracer.finalize();

      expect(trace.stages).toHaveLength(4);
      expect(trace.stages.map((s) => s.stage)).toEqual([
        "query_understanding",
        "retrieval",
        "post_retrieval",
        "citation",
      ]);
      expect(trace.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(trace.sourcesContributed["prd"]).toBe(2);
      expect(trace.sourcesContributed["docs"]).toBe(1);
      expect(trace.citationCount).toBe(3);
      expect(trace.totalTokensUsed).toBe(450);
    });
  });

  describe("end-to-end pipeline with real store", () => {
    it("should run full pipeline: understand → search → post-process → cite → trace", () => {
      // Seed store with nodes and knowledge
      const n1 = makeNode({ title: "Implement FTS5 search", description: "Full-text search with BM25 ranking" });
      const n2 = makeNode({ title: "Add knowledge store", description: "SQLite-backed knowledge document storage" });
      const n3 = makeNode({ title: "Build RAG pipeline", description: "TF-IDF embeddings with cosine similarity search" });
      store.insertNode(n1);
      store.insertNode(n2);
      store.insertNode(n3);

      const knowledgeStore = new KnowledgeStore(store.getDb());
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: "mem-1",
        title: "Knowledge architecture decision",
        content: "We chose FTS5 with BM25 for full-text search because it provides good relevance ranking without external dependencies.",
        chunkIndex: 0,
      });

      // 1. Query understanding
      const understanding = understandQuery("how does the search ranking work?");
      expect(understanding.intent).toBe("how_to");

      // 2. Multi-strategy search
      const rawResults = multiStrategySearch(store.getDb(), understanding.rewrittenQuery, {
        limit: 20,
      });

      // 3. Post-retrieval
      const postProcessed = postRetrievalPipeline({
        query: understanding.rewrittenQuery,
        results: rawResults,
        maxResults: 5,
      });

      // 4. Citation mapping
      const cited = buildCitedContext(postProcessed.results);

      // 5. Trace
      const tracer = new RagTracer("how does the search ranking work?");
      tracer.startStage("query_understanding");
      tracer.endStage("query_understanding", { inputCount: 1, outputCount: 1 });
      tracer.startStage("retrieval");
      tracer.endStage("retrieval", { inputCount: 1, outputCount: rawResults.length });
      tracer.startStage("post_retrieval");
      tracer.endStage("post_retrieval", { inputCount: rawResults.length, outputCount: postProcessed.results.length });
      tracer.startStage("citation");
      tracer.endStage("citation", { inputCount: postProcessed.results.length, outputCount: cited.citations.length });
      for (const [sourceType, count] of Object.entries(cited.sourceBreakdown)) {
        tracer.recordSourceContribution(sourceType, count);
      }
      tracer.setCitationCount(cited.citations.length);
      const trace = tracer.finalize();

      // Assertions
      expect(trace.stages).toHaveLength(4);
      expect(trace.totalLatencyMs).toBeGreaterThanOrEqual(0);

      // If we got results, citations should match
      if (postProcessed.results.length > 0) {
        expect(cited.citations.length).toBe(postProcessed.results.length);
        expect(cited.assembledText).toContain("[1]");
        expect(Object.keys(cited.sourceBreakdown).length).toBeGreaterThan(0);
      }
    });
  });
});
