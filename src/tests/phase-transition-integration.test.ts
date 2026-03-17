/**
 * Integration tests for phase transition hooks.
 * Covers: set_phase generating phase summaries, import_prd indexing into knowledge store.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexPrdContent } from "../core/rag/prd-indexer.js";
import { generateAndIndexPhaseSummary } from "../core/rag/phase-summary.js";
import { makeNode, makeEpic } from "./helpers/factories.js";

describe("import_prd knowledge indexing integration", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Import PRD Integration Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should make PRD content searchable via knowledge store after import", () => {
    const prdContent = `
# Product Requirements Document

## Feature: User Authentication
Users must be able to log in with email and password.
OAuth2 integration with Google and GitHub is required.

## Feature: Dashboard
A real-time dashboard showing task progress and sprint velocity.
Must support filtering by assignee and status.
    `.trim();

    indexPrdContent(knowledgeStore, prdContent, "auth-dashboard.md", "ANALYZE");

    // Search for specific requirements
    const authResults = knowledgeStore.search("OAuth2 authentication");
    expect(authResults.length).toBeGreaterThanOrEqual(1);
    expect(authResults[0].sourceType).toBe("prd");

    const dashResults = knowledgeStore.search("dashboard velocity");
    expect(dashResults.length).toBeGreaterThanOrEqual(1);
  });

  it("should include PRD in phase-aware search with ANALYZE boost", () => {
    indexPrdContent(
      knowledgeStore,
      "The search feature must support relevance ranking with BM25 scoring",
      "search-req.md",
      "ANALYZE",
    );

    const analyzeResults = knowledgeStore.searchWithPhaseBoost("relevance ranking", "ANALYZE");
    const implementResults = knowledgeStore.searchWithPhaseBoost("relevance ranking", "IMPLEMENT");

    expect(analyzeResults.length).toBeGreaterThanOrEqual(1);
    expect(implementResults.length).toBeGreaterThanOrEqual(1);

    // ANALYZE phase should give higher boost to ANALYZE-tagged PRD
    if (analyzeResults.length > 0 && implementResults.length > 0) {
      expect(analyzeResults[0].phaseBoost).toBeGreaterThan(implementResults[0].phaseBoost);
    }
  });

  it("should preserve PRD content across re-import (force)", () => {
    indexPrdContent(knowledgeStore, "Version 1: Login flow", "spec.md");
    expect(knowledgeStore.count("prd")).toBe(1);

    indexPrdContent(knowledgeStore, "Version 2: Updated login with MFA", "spec.md");
    expect(knowledgeStore.count("prd")).toBe(1);

    const results = knowledgeStore.search("MFA");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe("set_phase phase summary integration", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Phase Transition Integration Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should generate phase summary on ANALYZE → DESIGN transition", () => {
    store.insertNode(makeEpic({ title: "Authentication Epic" }));
    store.insertNode(makeNode({ type: "requirement", title: "OAuth2 requirement" }));

    const doc = store.toGraphDocument();
    const result = generateAndIndexPhaseSummary(knowledgeStore, doc, "ANALYZE", "DESIGN");

    expect(result.indexed).toBe(true);
    expect(result.summaryText).toContain("Phase ANALYZE completed");
    expect(result.summaryText).toContain("Requirements defined: 1");
    expect(result.summaryText).toContain("Epics: 1");

    expect(knowledgeStore.count("phase_summary")).toBe(1);
  });

  it("should generate phase summary on DESIGN → PLAN with decisions", () => {
    store.insertNode(makeNode({ type: "decision", title: "Use PostgreSQL" }));
    store.insertNode(makeNode({ type: "decision", title: "REST over gRPC" }));
    store.insertNode(makeNode({ type: "constraint", title: "Must support offline" }));

    const doc = store.toGraphDocument();
    const result = generateAndIndexPhaseSummary(knowledgeStore, doc, "DESIGN", "PLAN");

    expect(result.summaryText).toContain("Decisions: 2");
    expect(result.summaryText).toContain("Constraints: 1");
    expect(result.summaryText).toContain("Use PostgreSQL");
    expect(result.summaryText).toContain("REST over gRPC");
  });

  it("should generate phase summary on IMPLEMENT → VALIDATE with task progress", () => {
    store.insertNode(makeNode({ type: "task", title: "Task 1", status: "done" }));
    store.insertNode(makeNode({ type: "task", title: "Task 2", status: "done" }));
    store.insertNode(makeNode({ type: "task", title: "Task 3", status: "in_progress" }));

    const doc = store.toGraphDocument();
    const result = generateAndIndexPhaseSummary(knowledgeStore, doc, "IMPLEMENT", "VALIDATE");

    expect(result.summaryText).toContain("Tasks completed: 2/3");
  });

  it("should make phase summaries searchable for cross-phase RAG", () => {
    store.insertNode(makeNode({ type: "decision", title: "GraphQL architecture" }));

    const doc = store.toGraphDocument();
    generateAndIndexPhaseSummary(knowledgeStore, doc, "DESIGN", "PLAN");

    // Phase summary should be findable
    const results = knowledgeStore.search("GraphQL architecture");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sourceType).toBe("phase_summary");
  });

  it("should accumulate multiple phase summaries across lifecycle", () => {
    // Simulate full lifecycle
    store.insertNode(makeNode({ type: "requirement", title: "Login" }));
    let doc = store.toGraphDocument();
    generateAndIndexPhaseSummary(knowledgeStore, doc, "ANALYZE", "DESIGN");

    store.insertNode(makeNode({ type: "decision", title: "Use JWT" }));
    doc = store.toGraphDocument();
    generateAndIndexPhaseSummary(knowledgeStore, doc, "DESIGN", "PLAN");

    store.insertNode(makeNode({ type: "task", title: "Impl Login", status: "done", sprint: "s1" }));
    doc = store.toGraphDocument();
    generateAndIndexPhaseSummary(knowledgeStore, doc, "PLAN", "IMPLEMENT");

    expect(knowledgeStore.count("phase_summary")).toBe(3);

    // All summaries should be searchable
    const results = knowledgeStore.search("Phase");
    expect(results.length).toBe(3);
  });

  it("should tag phase summaries with metadata for phase-aware boosting", () => {
    const doc = store.toGraphDocument();
    generateAndIndexPhaseSummary(knowledgeStore, doc, "DESIGN", "PLAN");

    const docs = knowledgeStore.list({ sourceType: "phase_summary" });
    expect(docs).toHaveLength(1);
    expect(docs[0].metadata).toMatchObject({
      phase: "DESIGN",
      transitionTo: "PLAN",
    });
    expect(docs[0].metadata).toHaveProperty("transitionedAt");
  });
});
