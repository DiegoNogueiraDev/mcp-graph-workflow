import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { CodeStore } from "../core/code/code-store.js";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { searchCodeSymbols } from "../core/code/code-search.js";

describe("code-search", () => {
  let db: Database.Database;
  let store: CodeStore;
  const projectId = "proj_search";

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new CodeStore(db);

    // Seed test symbols
    store.insertSymbolsBulk([
      { projectId, name: "buildTaskContext", kind: "function", file: "src/core/context/builder.ts", startLine: 1, endLine: 50, exported: true, signature: "(taskId: string) => TaskContext", modulePath: "core/context" },
      { projectId, name: "validateNode", kind: "function", file: "src/core/graph/validator.ts", startLine: 1, endLine: 30, exported: true, signature: "(node: GraphNode) => boolean", modulePath: "core/graph" },
      { projectId, name: "validateEdge", kind: "function", file: "src/core/graph/validator.ts", startLine: 35, endLine: 60, exported: true, signature: "(edge: GraphEdge) => boolean", modulePath: "core/graph" },
      { projectId, name: "SqliteStore", kind: "class", file: "src/core/store/sqlite-store.ts", startLine: 1, endLine: 300, exported: true, modulePath: "core/store" },
      { projectId, name: "formatOutput", kind: "function", file: "src/cli/format.ts", startLine: 1, endLine: 20, exported: true, modulePath: "cli" },
    ]);
  });

  afterEach(() => {
    db.close();
  });

  it("should find symbols by name query", () => {
    const results = searchCodeSymbols(store, "validate", projectId);
    expect(results.length).toBeGreaterThanOrEqual(2);

    const names = results.map((r) => r.symbol.name);
    expect(names).toContain("validateNode");
    expect(names).toContain("validateEdge");
  });

  it("should find symbols by file path query", () => {
    const results = searchCodeSymbols(store, "sqlite", projectId);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol.name).toBe("SqliteStore");
  });

  it("should return empty for no matches", () => {
    const results = searchCodeSymbols(store, "xyznonexistent", projectId);
    expect(results).toHaveLength(0);
  });

  it("should respect limit option", () => {
    const results = searchCodeSymbols(store, "validate", projectId, { limit: 1 });
    expect(results).toHaveLength(1);
  });

  it("should group results by module when requested", () => {
    const results = searchCodeSymbols(store, "validate", projectId, { groupByModule: true });
    expect(results.length).toBeGreaterThanOrEqual(2);
    // All validate results should have the same modulePath
    expect(results.every((r) => r.modulePath === "core/graph")).toBe(true);
  });
});
