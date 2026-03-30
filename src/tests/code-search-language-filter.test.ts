/**
 * TDD Red: Tests for language filter in code-search.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { CodeStore } from "../core/code/code-store.js";
import { searchCodeSymbols } from "../core/code/code-search.js";

describe("code-search — language filter", () => {
  let db: Database.Database;
  let store: CodeStore;
  const projectId = "test-project";

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new CodeStore(db);

    store.insertSymbolsBulk([
      { projectId, name: "calculate_tax", kind: "function", file: "tax.py", startLine: 1, endLine: 10, exported: true, language: "python", docstring: "Calculate tax" },
      { projectId, name: "validate_input", kind: "function", file: "validate.py", startLine: 1, endLine: 5, exported: true, language: "python" },
      { projectId, name: "HandleRequest", kind: "function", file: "handler.go", startLine: 1, endLine: 20, exported: true, language: "go" },
      { projectId, name: "calculateTotal", kind: "function", file: "calc.ts", startLine: 1, endLine: 15, exported: true, language: "typescript" },
    ]);
  });

  it("should return only Python symbols when language='python'", () => {
    const results = searchCodeSymbols(store, "calculate", projectId, { language: "python" });
    expect(results.length).toBe(1);
    expect(results[0].symbol.name).toBe("calculate_tax");
    expect(results[0].symbol.language).toBe("python");
  });

  it("should return only Go symbols when language='go'", () => {
    const results = searchCodeSymbols(store, "Handle", projectId, { language: "go" });
    expect(results.length).toBe(1);
    expect(results[0].symbol.language).toBe("go");
  });

  it("should return all languages when no language filter (backward compat)", () => {
    const results = searchCodeSymbols(store, "calculate", projectId);
    expect(results.length).toBe(2); // calculate_tax (py) + calculateTotal (ts)
  });

  it("should return empty when language has no matches", () => {
    const results = searchCodeSymbols(store, "calculate", projectId, { language: "rust" });
    expect(results.length).toBe(0);
  });
});
