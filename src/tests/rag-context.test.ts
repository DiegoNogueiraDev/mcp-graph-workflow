import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { ragBuildContext } from "../core/context/rag-context.js";
import { makeNode } from "./helpers/factories.js";

describe("ragBuildContext", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("RAG Test");
  });

  afterEach(() => {
    store.close();
  });

  it("returns context with matching nodes", () => {
    store.insertNode(makeNode({ title: "Implement parser module", description: "Parse PRD files" }));
    store.insertNode(makeNode({ title: "Create database", description: "SQLite storage" }));

    const ctx = ragBuildContext(store, "parser");
    expect(ctx.query).toBe("parser");
    expect(ctx.relevantNodes.length).toBeGreaterThan(0);
    expect(ctx.relevantNodes[0].title).toContain("parser");
  });

  it("returns empty results for no match", () => {
    store.insertNode(makeNode({ title: "Hello world" }));

    const ctx = ragBuildContext(store, "nonexistent");
    expect(ctx.relevantNodes).toHaveLength(0);
    expect(ctx.expandedContexts).toHaveLength(0);
  });

  it("respects token budget", () => {
    // Insert several nodes
    for (let i = 0; i < 10; i++) {
      store.insertNode(
        makeNode({
          title: `Parser task ${i}`,
          description: `Detailed description for parser task ${i} with lots of text to consume tokens`,
        }),
      );
    }

    const ctx = ragBuildContext(store, "parser", 500);
    expect(ctx.tokenUsage.budget).toBe(500);
    expect(ctx.tokenUsage.used).toBeLessThanOrEqual(ctx.tokenUsage.budget + 200); // allow some overflow for first context
  });

  it("includes expanded contexts", () => {
    const parentNode = makeNode({ title: "Parser epic", type: "epic" });
    store.insertNode(parentNode);

    const childNode = makeNode({
      title: "Parser subtask",
      type: "subtask",
      parentId: parentNode.id,
      description: "Implement parser core logic",
    });
    store.insertNode(childNode);

    const ctx = ragBuildContext(store, "parser", 8000);
    expect(ctx.expandedContexts.length).toBeGreaterThan(0);
  });

  it("token usage reports remaining correctly", () => {
    store.insertNode(makeNode({ title: "Parser task", description: "Parse files" }));

    const ctx = ragBuildContext(store, "parser", 4000);
    expect(ctx.tokenUsage.remaining).toBe(
      Math.max(0, ctx.tokenUsage.budget - ctx.tokenUsage.used),
    );
  });
});
