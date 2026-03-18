/**
 * Tests for code-search.ts — searchCodeSymbols with FTS5, TF-IDF reranking,
 * groupByModule, limit, and edge cases.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { CodeStore } from "../core/code/code-store.js";
import { searchCodeSymbols } from "../core/code/code-search.js";

const PROJECT_ID = "proj_test";

function makeSymbol(overrides: Partial<{
  name: string;
  kind: string;
  file: string;
  startLine: number;
  endLine: number;
  exported: boolean;
  modulePath: string | null;
  signature: string | null;
}> = {}) {
  return {
    projectId: PROJECT_ID,
    name: overrides.name ?? "testFunction",
    kind: (overrides.kind ?? "function") as "function" | "class" | "method" | "interface" | "type_alias" | "enum" | "variable",
    file: overrides.file ?? "src/core/utils.ts",
    startLine: overrides.startLine ?? 1,
    endLine: overrides.endLine ?? 10,
    exported: overrides.exported ?? true,
    modulePath: overrides.modulePath ?? "core/utils",
    signature: overrides.signature ?? null,
  };
}

describe("searchCodeSymbols", () => {
  let store: SqliteStore;
  let codeStore: CodeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    codeStore = new CodeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty array when no symbols match", () => {
    const results = searchCodeSymbols(codeStore, "nonexistent", PROJECT_ID);
    expect(results).toEqual([]);
  });

  it("should find symbol by name using FTS5", () => {
    codeStore.insertSymbol(makeSymbol({ name: "validateNode", file: "src/core/graph.ts" }));
    codeStore.insertSymbol(makeSymbol({ name: "createEdge", file: "src/core/graph.ts" }));

    const results = searchCodeSymbols(codeStore, "validateNode", PROJECT_ID);

    expect(results.length).toBe(1);
    expect(results[0].symbol.name).toBe("validateNode");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("should find multiple symbols matching the query", () => {
    codeStore.insertSymbol(makeSymbol({ name: "validateNode", file: "src/core/graph.ts" }));
    codeStore.insertSymbol(makeSymbol({ name: "validateEdge", file: "src/core/graph.ts" }));
    codeStore.insertSymbol(makeSymbol({ name: "createNode", file: "src/core/graph.ts" }));

    const results = searchCodeSymbols(codeStore, "validate", PROJECT_ID);

    expect(results.length).toBe(2);
    const names = results.map((r) => r.symbol.name);
    expect(names).toContain("validateNode");
    expect(names).toContain("validateEdge");
  });

  it("should respect the limit option", () => {
    for (let i = 0; i < 10; i++) {
      codeStore.insertSymbol(makeSymbol({
        name: `searchHandler${i}`,
        file: `src/search/handler${i}.ts`,
      }));
    }

    const results = searchCodeSymbols(codeStore, "search", PROJECT_ID, { limit: 3 });

    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("should rerank with TF-IDF when rerank option is true", () => {
    codeStore.insertSymbol(makeSymbol({
      name: "buildContext",
      file: "src/core/context/builder.ts",
      signature: "function buildContext(nodeId: string): Context",
    }));
    codeStore.insertSymbol(makeSymbol({
      name: "contextAssembler",
      file: "src/core/context/assembler.ts",
      signature: "function contextAssembler(): void",
    }));
    codeStore.insertSymbol(makeSymbol({
      name: "unrelatedThing",
      file: "src/core/utils/id.ts",
      signature: "function unrelatedThing(): string",
    }));

    const results = searchCodeSymbols(codeStore, "buildContext", PROJECT_ID, {
      rerank: true,
      limit: 10,
    });

    // Should return at least the exact match
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol.name).toBe("buildContext");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("should group results by module path when groupByModule is true", () => {
    codeStore.insertSymbol(makeSymbol({
      name: "parseNodeA",
      file: "src/core/parser/node.ts",
      modulePath: "core/parser",
    }));
    codeStore.insertSymbol(makeSymbol({
      name: "parseNodeB",
      file: "src/core/graph/node.ts",
      modulePath: "core/graph",
    }));
    codeStore.insertSymbol(makeSymbol({
      name: "parseNodeC",
      file: "src/core/parser/edge.ts",
      modulePath: "core/parser",
    }));

    const results = searchCodeSymbols(codeStore, "parseNode", PROJECT_ID, {
      groupByModule: true,
    });

    expect(results.length).toBe(3);

    // Grouped by module: all "core/graph" together, all "core/parser" together
    const modules = results.map((r) => r.modulePath);
    const _graphIdx = modules.indexOf("core/graph");
    const parserIndices = modules
      .map((m, i) => (m === "core/parser" ? i : -1))
      .filter((i) => i >= 0);

    // parser entries should be adjacent
    if (parserIndices.length > 1) {
      expect(parserIndices[1] - parserIndices[0]).toBe(1);
    }
  });

  it("should handle special characters in query by sanitizing", () => {
    codeStore.insertSymbol(makeSymbol({ name: "handleError", file: "src/errors.ts" }));

    // Special chars should be sanitized, not cause FTS5 syntax errors
    const results = searchCodeSymbols(codeStore, 'handle*"Error()', PROJECT_ID);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol.name).toBe("handleError");
  });

  it("should return empty for completely empty query after sanitization", () => {
    codeStore.insertSymbol(makeSymbol({ name: "something", file: "src/a.ts" }));

    // Query of only special chars gets sanitized to empty
    const results = searchCodeSymbols(codeStore, "***!!!", PROJECT_ID);

    // Empty sanitized query results in '""' which matches nothing
    expect(results).toEqual([]);
  });

  it("should include modulePath in result objects", () => {
    codeStore.insertSymbol(makeSymbol({
      name: "myFunction",
      file: "src/core/store/db.ts",
      modulePath: "core/store",
    }));

    const results = searchCodeSymbols(codeStore, "myFunction", PROJECT_ID);

    expect(results.length).toBe(1);
    expect(results[0].modulePath).toBe("core/store");
  });

  it("should search by file path as well as name", () => {
    codeStore.insertSymbol(makeSymbol({
      name: "init",
      file: "src/core/store/sqlite-store.ts",
    }));

    const results = searchCodeSymbols(codeStore, "sqlite", PROJECT_ID);

    expect(results.length).toBe(1);
    expect(results[0].symbol.file).toContain("sqlite");
  });
});
