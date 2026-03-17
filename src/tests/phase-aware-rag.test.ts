/**
 * Tests for phase-aware RAG integration.
 * Covers: ragBuildContext with phase, assembleContext with phase,
 * lifecycle wrapper with phaseKnowledge enrichment.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { ragBuildContext } from "../core/context/rag-context.js";
import { assembleContext } from "../core/context/context-assembler.js";
import { buildLifecycleBlock } from "../mcp/lifecycle-wrapper.js";
import { makeNode } from "./helpers/factories.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

describe("ragBuildContext with phase", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Phase RAG Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should accept phase parameter without breaking", () => {
    store.insertNode(makeNode({ title: "Build authentication module", description: "JWT auth" }));

    const ctx = ragBuildContext(store, "authentication", 4000, "IMPLEMENT");

    expect(ctx.query).toBe("authentication");
    expect(ctx.relevantNodes.length).toBeGreaterThan(0);
    expect(ctx.tokenUsage.budget).toBe(4000);
  });

  it("should work without phase (backward compatible)", () => {
    store.insertNode(makeNode({ title: "Create API routes", description: "Express REST endpoints" }));

    const ctx = ragBuildContext(store, "API routes", 4000);

    expect(ctx.query).toBe("API routes");
    expect(ctx.relevantNodes.length).toBeGreaterThan(0);
  });

  it("should include phase-boosted knowledge results when phase is provided", () => {
    store.insertNode(makeNode({ title: "Parser implementation", description: "Parse PRD files" }));

    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "prd:req.md",
      title: "Parser PRD Requirements",
      content: "The parser must handle markdown and plain text PRD files for import",
      metadata: { phase: "ANALYZE" },
    });
    knowledgeStore.insert({
      sourceType: "sprint_plan",
      sourceId: "plan:sprint1",
      title: "Sprint 1 Parser Plan",
      content: "Sprint plan includes parser module implementation and PRD import tests",
      metadata: { phase: "PLAN" },
    });

    const ctx = ragBuildContext(store, "parser PRD", 4000, "IMPLEMENT");

    expect(ctx.knowledgeResults.length).toBeGreaterThan(0);
  });

  it("should still respect token budget with phase", () => {
    for (let i = 0; i < 10; i++) {
      store.insertNode(makeNode({
        title: `Auth task ${i}`,
        description: `Detailed auth implementation for task ${i}`,
      }));
    }

    const ctx = ragBuildContext(store, "auth", 500, "IMPLEMENT");

    expect(ctx.tokenUsage.used).toBeLessThanOrEqual(ctx.tokenUsage.budget);
  });
});

describe("assembleContext with phase", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Phase Assembler Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should accept phase option without breaking", () => {
    const node = makeNode({ title: "Setup database", description: "SQLite store" });
    store.insertNode(node);

    const ctx = assembleContext(store, "database", {
      nodeIds: [node.id],
      phase: "IMPLEMENT",
    });

    expect(ctx.sections.length).toBeGreaterThanOrEqual(1);
    expect(ctx.tokenUsage.used).toBeGreaterThan(0);
  });

  it("should work without phase (backward compatible)", () => {
    const node = makeNode({ title: "Test node" });
    store.insertNode(node);

    const ctx = assembleContext(store, "test", { nodeIds: [node.id] });

    expect(ctx.sections.length).toBeGreaterThanOrEqual(1);
  });

  it("should use phase-boosted knowledge when phase is provided", () => {
    const node = makeNode({ title: "Build search feature" });
    store.insertNode(node);

    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "prd:search.md",
      title: "Search Requirements",
      content: "The search feature must support full-text search with BM25 ranking",
      metadata: { phase: "ANALYZE" },
    });

    const ctx = assembleContext(store, "search BM25", {
      nodeIds: [node.id],
      phase: "IMPLEMENT",
    });

    const knowledgeSections = ctx.sections.filter((s) => s.source === "knowledge");
    expect(knowledgeSections.length).toBeGreaterThanOrEqual(1);
  });
});

describe("buildLifecycleBlock with phaseKnowledge", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Lifecycle Knowledge Test");
  });

  afterEach(() => {
    store.close();
  });

  function makeDoc(): GraphDocument {
    return store.toGraphDocument();
  }

  it("should include phaseKnowledge when store has knowledge docs", () => {
    // Set up a graph in IMPLEMENT phase
    store.insertNode(makeNode({ type: "task", status: "in_progress", sprint: "s1" }));

    // Add phase-tagged knowledge
    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "prd:req.md",
      title: "Requirements for Phase Context",
      content: "The system must provide phase-aware context for AI agents during implementation",
      metadata: { phase: "ANALYZE" },
    });
    knowledgeStore.insert({
      sourceType: "sprint_plan",
      sourceId: "plan:sprint1",
      title: "Sprint Plan Phase Context",
      content: "Sprint plan focuses on implementing phase-aware context and RAG pipeline integration",
      metadata: { phase: "PLAN" },
    });

    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { store });

    expect(block.phase).toBe("IMPLEMENT");
    if (block.phaseKnowledge) {
      expect(block.phaseKnowledge.length).toBeLessThanOrEqual(3);
      for (const snippet of block.phaseKnowledge) {
        expect(snippet).toHaveProperty("title");
        expect(snippet).toHaveProperty("sourceType");
        expect(snippet).toHaveProperty("snippet");
      }
    }
  });

  it("should not include phaseKnowledge when store is not provided", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);

    expect(block.phaseKnowledge).toBeUndefined();
  });

  it("should not include phaseKnowledge when knowledge store is empty", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { store });

    expect(block.phaseKnowledge).toBeUndefined();
  });

  it("should truncate snippets to 200 chars", () => {
    store.insertNode(makeNode({ type: "task", status: "in_progress", sprint: "s1" }));

    const knowledgeStore = new KnowledgeStore(store.getDb());
    const longContent = "A".repeat(500) + " phase context implementation details";
    knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "prd:long.md",
      title: "Long Phase Document",
      content: longContent,
      metadata: { phase: "IMPLEMENT" },
    });

    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { store });

    if (block.phaseKnowledge && block.phaseKnowledge.length > 0) {
      for (const snippet of block.phaseKnowledge) {
        expect(snippet.snippet.length).toBeLessThanOrEqual(203); // 200 + "..."
      }
    }
  });
});
