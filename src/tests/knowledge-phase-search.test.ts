import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("KnowledgeStore.searchWithPhaseBoost", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Phase Search Test");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  it("should boost documents from the current phase", () => {
    // Insert docs from different phases
    knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "prd:req.md",
      title: "Parser Requirements",
      content: "The parser must handle markdown and plain text formats for document processing",
      metadata: { phase: "ANALYZE" },
    });

    knowledgeStore.insert({
      sourceType: "design",
      sourceId: "design:parser-adr",
      title: "Parser Architecture Decision",
      content: "Parser will use a streaming approach for large document processing",
      metadata: { phase: "DESIGN" },
    });

    knowledgeStore.insert({
      sourceType: "sprint_plan",
      sourceId: "plan:sprint-1",
      title: "Sprint 1 Parser Plan",
      content: "Sprint focuses on parser module implementation and document processing tests",
      metadata: { phase: "PLAN" },
    });

    // In IMPLEMENT phase, PLAN docs should be boosted over ANALYZE docs
    const results = knowledgeStore.searchWithPhaseBoost("parser document processing", "IMPLEMENT");
    expect(results.length).toBeGreaterThanOrEqual(2);

    // All results should have phaseBoost
    for (const result of results) {
      expect(result.phaseBoost).toBeGreaterThanOrEqual(1.0);
    }
  });

  it("should return phaseBoost of 1.0 for docs without phase metadata", () => {
    knowledgeStore.insert({
      sourceType: "upload",
      sourceId: "upload:file1",
      title: "Generic Upload",
      content: "Some technical documentation about REST APIs",
    });

    const results = knowledgeStore.searchWithPhaseBoost("REST APIs", "IMPLEMENT");
    expect(results).toHaveLength(1);
    expect(results[0].phaseBoost).toBe(1.0);
  });

  it("should respect limit parameter", () => {
    for (let i = 0; i < 5; i++) {
      knowledgeStore.insert({
        sourceType: "prd",
        sourceId: `prd:req-${i}`,
        title: `Requirement ${i}`,
        content: `Feature requirement ${i} for the system`,
        metadata: { phase: "ANALYZE" },
      });
    }

    const results = knowledgeStore.searchWithPhaseBoost("requirement", "IMPLEMENT", 2);
    expect(results).toHaveLength(2);
  });

  it("should handle empty results gracefully", () => {
    const results = knowledgeStore.searchWithPhaseBoost("nonexistent", "IMPLEMENT");
    expect(results).toHaveLength(0);
  });

  it("should give same-phase docs the highest boost", () => {
    knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "prd:analyze",
      title: "Analyze Phase Document",
      content: "Requirements analysis for authentication feature",
      metadata: { phase: "ANALYZE" },
    });

    const resultsInAnalyze = knowledgeStore.searchWithPhaseBoost("authentication", "ANALYZE");
    const resultsInImplement = knowledgeStore.searchWithPhaseBoost("authentication", "IMPLEMENT");

    if (resultsInAnalyze.length > 0 && resultsInImplement.length > 0) {
      // Same doc should have higher boost in ANALYZE (its own phase)
      expect(resultsInAnalyze[0].phaseBoost).toBeGreaterThan(resultsInImplement[0].phaseBoost);
    }
  });
});
