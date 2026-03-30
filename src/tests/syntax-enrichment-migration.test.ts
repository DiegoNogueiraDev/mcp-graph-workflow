/**
 * TDD Red: Tests for syntax enrichment migration (version 21).
 * Validates new columns (language, docstring, source_snippet, visibility)
 * and FTS5 rebuild with docstring field.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";

describe("Migration 21 — Syntax Enrichment columns", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("should add language column with default 'typescript'", () => {
    const info = db.pragma("table_info(code_symbols)") as Array<{ name: string; dflt_value: string | null }>;
    const col = info.find((c) => c.name === "language");
    expect(col).toBeDefined();
    expect(col!.dflt_value).toBe("'typescript'");
  });

  it("should add docstring column (nullable)", () => {
    const info = db.pragma("table_info(code_symbols)") as Array<{ name: string }>;
    const col = info.find((c) => c.name === "docstring");
    expect(col).toBeDefined();
  });

  it("should add source_snippet column (nullable)", () => {
    const info = db.pragma("table_info(code_symbols)") as Array<{ name: string }>;
    const col = info.find((c) => c.name === "source_snippet");
    expect(col).toBeDefined();
  });

  it("should add visibility column with default 'public'", () => {
    const info = db.pragma("table_info(code_symbols)") as Array<{ name: string; dflt_value: string | null }>;
    const col = info.find((c) => c.name === "visibility");
    expect(col).toBeDefined();
    expect(col!.dflt_value).toBe("'public'");
  });

  it("should insert symbol with new fields and retrieve them", () => {
    db.prepare(`
      INSERT INTO code_symbols (id, project_id, name, kind, file, start_line, end_line, exported, language, docstring, source_snippet, visibility, indexed_at)
      VALUES ('csym_test1', 'proj1', 'my_func', 'function', 'main.py', 1, 10, 1, 'python', 'Does something useful', 'def my_func():\n  pass', 'public', '2026-01-01')
    `).run();

    const row = db.prepare("SELECT language, docstring, source_snippet, visibility FROM code_symbols WHERE id = 'csym_test1'").get() as {
      language: string;
      docstring: string;
      source_snippet: string;
      visibility: string;
    };

    expect(row.language).toBe("python");
    expect(row.docstring).toBe("Does something useful");
    expect(row.source_snippet).toBe("def my_func():\n  pass");
    expect(row.visibility).toBe("public");
  });

  it("should default language to 'typescript' when not specified", () => {
    db.prepare(`
      INSERT INTO code_symbols (id, project_id, name, kind, file, start_line, end_line, exported, indexed_at)
      VALUES ('csym_test2', 'proj1', 'foo', 'function', 'test.ts', 1, 5, 1, '2026-01-01')
    `).run();

    const row = db.prepare("SELECT language, visibility FROM code_symbols WHERE id = 'csym_test2'").get() as {
      language: string;
      visibility: string;
    };

    expect(row.language).toBe("typescript");
    expect(row.visibility).toBe("public");
  });

  it("should include docstring in FTS5 search results", () => {
    db.prepare(`
      INSERT INTO code_symbols (id, project_id, name, kind, file, start_line, end_line, exported, language, docstring, indexed_at)
      VALUES ('csym_fts1', 'proj1', 'calculate_tax', 'function', 'tax.py', 1, 20, 1, 'python', 'Calculate the tax amount based on income and deductions', '2026-01-01')
    `).run();

    // Search by docstring content — should find via FTS5
    const results = db.prepare(`
      SELECT cs.id, cs.name, cs.docstring
      FROM code_symbols_fts fts
      JOIN code_symbols cs ON cs.rowid = fts.rowid
      WHERE code_symbols_fts MATCH 'income deductions'
    `).all() as Array<{ id: string; name: string; docstring: string }>;

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("calculate_tax");
    expect(results[0].docstring).toContain("income and deductions");
  });

  it("should find symbols by name through FTS5 (backward compatible)", () => {
    db.prepare(`
      INSERT INTO code_symbols (id, project_id, name, kind, file, start_line, end_line, exported, indexed_at)
      VALUES ('csym_fts2', 'proj1', 'handleRequest', 'function', 'api.ts', 1, 15, 1, '2026-01-01')
    `).run();

    const results = db.prepare(`
      SELECT cs.id FROM code_symbols_fts fts
      JOIN code_symbols cs ON cs.rowid = fts.rowid
      WHERE code_symbols_fts MATCH 'handleRequest'
    `).all();

    expect(results).toHaveLength(1);
  });

  it("should add language index for filtered queries", () => {
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_code_sym_language'").all();
    expect(indexes).toHaveLength(1);
  });
});
