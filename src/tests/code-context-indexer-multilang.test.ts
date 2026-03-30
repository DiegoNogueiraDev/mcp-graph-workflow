/**
 * TDD Red: Tests for multi-language code-context-indexer.
 * Validates that symbols are grouped by language and docstrings are included.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexCodeAnalysis } from "../core/rag/code-context-indexer.js";
import type { CodeSymbolInput } from "../core/rag/code-context-indexer.js";

describe("code-context-indexer — multi-language", () => {
  let db: Database.Database;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    knowledgeStore = new KnowledgeStore(db);
  });

  it("should create separate knowledge docs per language", () => {
    const symbols: CodeSymbolInput[] = [
      { name: "calculate_tax", kind: "function", file: "tax.py", exported: true, language: "python" },
      { name: "validate_input", kind: "function", file: "validate.py", exported: true, language: "python" },
      { name: "HandleRequest", kind: "function", file: "handler.go", exported: true, language: "go" },
      { name: "Config", kind: "struct", file: "config.go", exported: true, language: "go" },
      { name: "main", kind: "function", file: "index.ts", exported: true, language: "typescript" },
    ];

    const result = indexCodeAnalysis(knowledgeStore, { symbols, flows: [] });

    // Should create at least 3 docs (one per language)
    expect(result.documentsIndexed).toBeGreaterThanOrEqual(3);
  });

  it("should include docstrings in knowledge doc content", () => {
    const symbols: CodeSymbolInput[] = [
      {
        name: "calculate_tax",
        kind: "function",
        file: "tax.py",
        exported: true,
        language: "python",
        docstring: "Calculate the tax amount based on income and deductions",
      },
    ];

    const result = indexCodeAnalysis(knowledgeStore, { symbols, flows: [] });
    expect(result.documentsIndexed).toBeGreaterThanOrEqual(1);

    // Search knowledge store for the docstring content
    const docs = knowledgeStore.search("Calculate tax income deductions", 10);
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs[0].content).toContain("Calculate the tax amount");
  });

  it("should include language in knowledge doc title", () => {
    const symbols: CodeSymbolInput[] = [
      { name: "my_func", kind: "function", file: "app.py", exported: true, language: "python" },
    ];

    const result = indexCodeAnalysis(knowledgeStore, { symbols, flows: [] });
    expect(result.documentsIndexed).toBeGreaterThanOrEqual(1);

    const docs = knowledgeStore.search("python", 10);
    const pyDoc = docs.find((d) => d.title.toLowerCase().includes("python"));
    expect(pyDoc).toBeDefined();
  });

  it("should still work with symbols without language (backward compat)", () => {
    const symbols: CodeSymbolInput[] = [
      { name: "oldFunc", kind: "function", file: "old.ts", exported: true },
    ];

    const result = indexCodeAnalysis(knowledgeStore, { symbols, flows: [] });
    expect(result.documentsIndexed).toBeGreaterThanOrEqual(1);
  });

  it("should include language metadata in knowledge docs", () => {
    const symbols: CodeSymbolInput[] = [
      { name: "rust_fn", kind: "function", file: "lib.rs", exported: true, language: "rust" },
    ];

    indexCodeAnalysis(knowledgeStore, { symbols, flows: [] });

    const docs = knowledgeStore.search("rust", 10);
    const rustDoc = docs.find((d) => d.title.toLowerCase().includes("rust") || d.content.includes("rust"));
    expect(rustDoc).toBeDefined();
  });
});
