/**
 * TDD Red: Tests for code-store.ts multi-language field support.
 * Validates that SymbolRow, rowToSymbol, insertSymbolsBulk handle
 * the new language, docstring, source_snippet, visibility columns,
 * and that findSymbolsByLanguage works correctly.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { CodeStore } from "../core/code/code-store.js";
import { CodeSymbolSchema } from "../core/code/code-types.js";

describe("CodeStore — multi-language fields", () => {
  let db: Database.Database;
  let store: CodeStore;
  const projectId = "test-project";

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new CodeStore(db);
  });

  describe("insertSymbolsBulk with new fields", () => {
    it("should persist language, docstring, source_snippet, visibility", () => {
      const count = store.insertSymbolsBulk([
        {
          projectId,
          name: "calculate_tax",
          kind: "function",
          file: "tax.py",
          startLine: 1,
          endLine: 20,
          exported: true,
          language: "python",
          docstring: "Calculate the tax amount based on income",
          sourceSnippet: "def calculate_tax(income):\n  return income * 0.3",
          visibility: "public",
        },
      ]);

      expect(count).toBe(1);

      const row = db.prepare(
        "SELECT language, docstring, source_snippet, visibility FROM code_symbols WHERE name = 'calculate_tax'",
      ).get() as { language: string; docstring: string; source_snippet: string; visibility: string };

      expect(row.language).toBe("python");
      expect(row.docstring).toBe("Calculate the tax amount based on income");
      expect(row.source_snippet).toBe("def calculate_tax(income):\n  return income * 0.3");
      expect(row.visibility).toBe("public");
    });

    it("should default language to 'typescript' and visibility to 'public' when omitted", () => {
      store.insertSymbolsBulk([
        {
          projectId,
          name: "foo",
          kind: "function",
          file: "foo.ts",
          startLine: 1,
          endLine: 5,
          exported: true,
        },
      ]);

      const row = db.prepare(
        "SELECT language, visibility FROM code_symbols WHERE name = 'foo'",
      ).get() as { language: string; visibility: string };

      expect(row.language).toBe("typescript");
      expect(row.visibility).toBe("public");
    });
  });

  describe("rowToSymbol with new fields", () => {
    it("should return language, docstring, sourceSnippet, visibility in CodeSymbol", () => {
      store.insertSymbolsBulk([
        {
          projectId,
          name: "HandleRequest",
          kind: "function",
          file: "handler.go",
          startLine: 10,
          endLine: 30,
          exported: true,
          language: "go",
          docstring: "HandleRequest processes incoming HTTP requests",
          sourceSnippet: "func HandleRequest(w http.ResponseWriter, r *http.Request) {",
          visibility: "public",
        },
      ]);

      const symbols = store.findSymbolsByName("HandleRequest", projectId);
      expect(symbols).toHaveLength(1);

      const sym = symbols[0];
      expect(sym.language).toBe("go");
      expect(sym.docstring).toBe("HandleRequest processes incoming HTTP requests");
      expect(sym.sourceSnippet).toBe("func HandleRequest(w http.ResponseWriter, r *http.Request) {");
      expect(sym.visibility).toBe("public");

      // Should validate against Zod schema
      const parsed = CodeSymbolSchema.safeParse(sym);
      expect(parsed.success).toBe(true);
    });

    it("should handle null docstring and sourceSnippet gracefully", () => {
      store.insertSymbolsBulk([
        {
          projectId,
          name: "bar",
          kind: "variable",
          file: "bar.ts",
          startLine: 1,
          endLine: 1,
          exported: false,
        },
      ]);

      const symbols = store.findSymbolsByName("bar", projectId);
      const sym = symbols[0];
      expect(sym.language).toBe("typescript");
      expect(sym.docstring).toBeUndefined();
      expect(sym.sourceSnippet).toBeUndefined();
      expect(sym.visibility).toBe("public");
    });
  });

  describe("findSymbolsByLanguage", () => {
    beforeEach(() => {
      store.insertSymbolsBulk([
        { projectId, name: "py_func", kind: "function", file: "a.py", startLine: 1, endLine: 5, exported: true, language: "python" },
        { projectId, name: "go_func", kind: "function", file: "b.go", startLine: 1, endLine: 5, exported: true, language: "go" },
        { projectId, name: "ts_func", kind: "function", file: "c.ts", startLine: 1, endLine: 5, exported: true, language: "typescript" },
        { projectId, name: "go_struct", kind: "struct", file: "d.go", startLine: 1, endLine: 10, exported: true, language: "go" },
      ]);
    });

    it("should return only symbols of the specified language", () => {
      const goSymbols = store.findSymbolsByLanguage("go", projectId);
      expect(goSymbols).toHaveLength(2);
      expect(goSymbols.map((s) => s.name).sort()).toEqual(["go_func", "go_struct"]);
    });

    it("should return empty array for language with no symbols", () => {
      const rustSymbols = store.findSymbolsByLanguage("rust", projectId);
      expect(rustSymbols).toHaveLength(0);
    });

    it("should filter by projectId", () => {
      store.insertSymbolsBulk([
        { projectId: "other-project", name: "other_py", kind: "function", file: "x.py", startLine: 1, endLine: 5, exported: true, language: "python" },
      ]);

      const pySymbols = store.findSymbolsByLanguage("python", projectId);
      expect(pySymbols).toHaveLength(1);
      expect(pySymbols[0].name).toBe("py_func");
    });
  });
});
