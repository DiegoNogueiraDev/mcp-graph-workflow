import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { CodeStore } from "../core/code/code-store.js";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("CodeStore", () => {
  let db: Database.Database;
  let store: CodeStore;
  const projectId = "proj_test123";

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new CodeStore(db);
  });

  afterEach(() => {
    db.close();
  });

  // ── Symbols ──────────────────────────────────

  describe("insertSymbol", () => {
    it("should insert a symbol and return it with generated id", () => {
      const result = store.insertSymbol({
        projectId,
        name: "myFunction",
        kind: "function",
        file: "src/utils.ts",
        startLine: 10,
        endLine: 25,
        exported: true,
        signature: "(a: string) => void",
      });

      expect(result.id).toMatch(/^csym_/);
      expect(result.name).toBe("myFunction");
      expect(result.kind).toBe("function");
      expect(result.exported).toBe(true);
      expect(result.indexedAt).toBeTruthy();
    });
  });

  describe("insertSymbolsBulk", () => {
    it("should insert multiple symbols in a transaction", () => {
      const count = store.insertSymbolsBulk([
        { projectId, name: "fn1", kind: "function", file: "a.ts", startLine: 1, endLine: 5, exported: true },
        { projectId, name: "fn2", kind: "function", file: "a.ts", startLine: 10, endLine: 15, exported: false },
        { projectId, name: "MyClass", kind: "class", file: "b.ts", startLine: 1, endLine: 50, exported: true },
      ]);

      expect(count).toBe(3);
      expect(store.getSymbolCount(projectId)).toBe(3);
    });
  });

  describe("getSymbol", () => {
    it("should retrieve a symbol by id", () => {
      const inserted = store.insertSymbol({
        projectId,
        name: "getUser",
        kind: "function",
        file: "src/user.ts",
        startLine: 1,
        endLine: 10,
        exported: true,
        metadata: { async: true },
      });

      const found = store.getSymbol(inserted.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("getUser");
      expect(found!.metadata).toEqual({ async: true });
    });

    it("should return null for non-existent id", () => {
      expect(store.getSymbol("csym_nonexistent")).toBeNull();
    });
  });

  describe("findSymbolsByName", () => {
    it("should find all symbols with given name in project", () => {
      store.insertSymbol({ projectId, name: "render", kind: "function", file: "a.ts", startLine: 1, endLine: 5, exported: true });
      store.insertSymbol({ projectId, name: "render", kind: "method", file: "b.ts", startLine: 10, endLine: 20, exported: false });
      store.insertSymbol({ projectId, name: "other", kind: "function", file: "c.ts", startLine: 1, endLine: 3, exported: true });

      const results = store.findSymbolsByName("render", projectId);
      expect(results).toHaveLength(2);
      expect(results.every((s) => s.name === "render")).toBe(true);
    });
  });

  describe("findSymbolsByFile", () => {
    it("should return all symbols in a file", () => {
      store.insertSymbol({ projectId, name: "fn1", kind: "function", file: "src/utils.ts", startLine: 1, endLine: 5, exported: true });
      store.insertSymbol({ projectId, name: "fn2", kind: "function", file: "src/utils.ts", startLine: 10, endLine: 15, exported: true });
      store.insertSymbol({ projectId, name: "fn3", kind: "function", file: "src/other.ts", startLine: 1, endLine: 5, exported: true });

      const results = store.findSymbolsByFile("src/utils.ts", projectId);
      expect(results).toHaveLength(2);
    });
  });

  describe("findSymbolAtLine", () => {
    it("should find the narrowest symbol containing a line", () => {
      store.insertSymbol({ projectId, name: "MyClass", kind: "class", file: "src/a.ts", startLine: 1, endLine: 50, exported: true });
      store.insertSymbol({ projectId, name: "myMethod", kind: "method", file: "src/a.ts", startLine: 10, endLine: 20, exported: false });

      const result = store.findSymbolAtLine("src/a.ts", 15, projectId);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("myMethod");
    });
  });

  describe("deleteSymbolsByFile", () => {
    it("should delete symbols and their relations from a file", () => {
      const s1 = store.insertSymbol({ projectId, name: "fn1", kind: "function", file: "src/a.ts", startLine: 1, endLine: 5, exported: true });
      const s2 = store.insertSymbol({ projectId, name: "fn2", kind: "function", file: "src/b.ts", startLine: 1, endLine: 5, exported: true });

      store.insertRelation({ projectId, fromSymbol: s1.id, toSymbol: s2.id, type: "calls" });

      const deleted = store.deleteSymbolsByFile("src/a.ts", projectId);
      expect(deleted).toBe(1);
      expect(store.getSymbolCount(projectId)).toBe(1);
      expect(store.getRelationsFrom(s1.id)).toHaveLength(0);
    });
  });

  describe("deleteAllSymbols", () => {
    it("should delete all symbols and relations for a project", () => {
      const s1 = store.insertSymbol({ projectId, name: "fn1", kind: "function", file: "a.ts", startLine: 1, endLine: 5, exported: true });
      const s2 = store.insertSymbol({ projectId, name: "fn2", kind: "function", file: "b.ts", startLine: 1, endLine: 5, exported: true });
      store.insertRelation({ projectId, fromSymbol: s1.id, toSymbol: s2.id, type: "calls" });

      store.deleteAllSymbols(projectId);
      expect(store.getSymbolCount(projectId)).toBe(0);
      expect(store.getRelationCount(projectId)).toBe(0);
    });
  });

  // ── Relations ────────────────────────────────

  describe("insertRelation", () => {
    it("should insert a relation and return it with generated id", () => {
      const s1 = store.insertSymbol({ projectId, name: "caller", kind: "function", file: "a.ts", startLine: 1, endLine: 5, exported: true });
      const s2 = store.insertSymbol({ projectId, name: "callee", kind: "function", file: "b.ts", startLine: 1, endLine: 5, exported: true });

      const rel = store.insertRelation({
        projectId,
        fromSymbol: s1.id,
        toSymbol: s2.id,
        type: "calls",
        file: "a.ts",
        line: 3,
      });

      expect(rel.id).toMatch(/^crel_/);
      expect(rel.type).toBe("calls");
    });
  });

  describe("exports relation type", () => {
    it("should accept 'exports' as a valid relation type", () => {
      const s1 = store.insertSymbol({ projectId, name: "index", kind: "variable", file: "index.ts", startLine: 1, endLine: 1, exported: true });
      const s2 = store.insertSymbol({ projectId, name: "foo", kind: "function", file: "foo.ts", startLine: 1, endLine: 5, exported: true });

      const rel = store.insertRelation({
        projectId,
        fromSymbol: s1.id,
        toSymbol: s2.id,
        type: "exports",
        file: "index.ts",
        line: 1,
        metadata: { reExportFrom: "./foo.js" },
      });

      expect(rel.id).toMatch(/^crel_/);
      expect(rel.type).toBe("exports");
    });
  });

  describe("insertRelationsBulk", () => {
    it("should insert multiple relations in a transaction", () => {
      const s1 = store.insertSymbol({ projectId, name: "a", kind: "function", file: "a.ts", startLine: 1, endLine: 5, exported: true });
      const s2 = store.insertSymbol({ projectId, name: "b", kind: "function", file: "b.ts", startLine: 1, endLine: 5, exported: true });
      const s3 = store.insertSymbol({ projectId, name: "c", kind: "function", file: "c.ts", startLine: 1, endLine: 5, exported: true });

      const count = store.insertRelationsBulk([
        { projectId, fromSymbol: s1.id, toSymbol: s2.id, type: "calls" },
        { projectId, fromSymbol: s2.id, toSymbol: s3.id, type: "imports" },
      ]);

      expect(count).toBe(2);
      expect(store.getRelationCount(projectId)).toBe(2);
    });
  });

  describe("getRelationsFrom / getRelationsTo", () => {
    it("should return outgoing and incoming relations", () => {
      const s1 = store.insertSymbol({ projectId, name: "a", kind: "function", file: "a.ts", startLine: 1, endLine: 5, exported: true });
      const s2 = store.insertSymbol({ projectId, name: "b", kind: "function", file: "b.ts", startLine: 1, endLine: 5, exported: true });
      store.insertRelation({ projectId, fromSymbol: s1.id, toSymbol: s2.id, type: "calls" });

      expect(store.getRelationsFrom(s1.id)).toHaveLength(1);
      expect(store.getRelationsTo(s2.id)).toHaveLength(1);
      expect(store.getRelationsFrom(s2.id)).toHaveLength(0);
    });
  });

  describe("BFS traversal follows exports edges", () => {
    it("should traverse exports edges via getRelationsFrom/getRelationsTo", () => {
      // foo.ts exports foo → index.ts re-exports via "exports" → consumer.ts calls foo via index
      const foo = store.insertSymbol({ projectId, name: "foo", kind: "function", file: "foo.ts", startLine: 1, endLine: 5, exported: true });
      const indexReExport = store.insertSymbol({ projectId, name: "foo", kind: "variable", file: "index.ts", startLine: 1, endLine: 1, exported: true });
      const consumer = store.insertSymbol({ projectId, name: "main", kind: "function", file: "consumer.ts", startLine: 1, endLine: 10, exported: true });

      // index.ts re-exports foo
      store.insertRelation({ projectId, fromSymbol: indexReExport.id, toSymbol: foo.id, type: "exports" });
      // consumer imports from index (via the re-exported symbol)
      store.insertRelation({ projectId, fromSymbol: consumer.id, toSymbol: indexReExport.id, type: "calls" });

      // BFS upstream from foo should find: indexReExport (via exports), then consumer (via calls)
      const fromFoo = store.getRelationsTo(foo.id);
      expect(fromFoo.length).toBe(1);
      expect(fromFoo[0].type).toBe("exports");

      const fromIndex = store.getRelationsTo(indexReExport.id);
      expect(fromIndex.length).toBe(1);
      expect(fromIndex[0].type).toBe("calls");
    });
  });

  // ── FTS5 Search ──────────────────────────────

  describe("searchSymbols", () => {
    it("should find symbols by name via FTS5", () => {
      store.insertSymbol({ projectId, name: "buildTaskContext", kind: "function", file: "src/context.ts", startLine: 1, endLine: 50, exported: true, signature: "(taskId: string) => TaskContext" });
      store.insertSymbol({ projectId, name: "formatOutput", kind: "function", file: "src/format.ts", startLine: 1, endLine: 20, exported: true });

      const results = store.searchSymbols('"buildTaskContext"', projectId);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].symbol.name).toBe("buildTaskContext");
    });

    it("should find symbols by file path via FTS5", () => {
      store.insertSymbol({ projectId, name: "fn1", kind: "function", file: "src/core/context/builder.ts", startLine: 1, endLine: 5, exported: true });
      store.insertSymbol({ projectId, name: "fn2", kind: "function", file: "src/api/routes.ts", startLine: 1, endLine: 5, exported: true });

      const results = store.searchSymbols('"context"', projectId);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Index Meta ───────────────────────────────

  describe("upsertIndexMeta / getIndexMeta", () => {
    it("should insert and retrieve index metadata", () => {
      store.upsertIndexMeta({
        projectId,
        lastIndexed: "2025-01-01T00:00:00Z",
        fileCount: 100,
        symbolCount: 500,
        relationCount: 1200,
        gitHash: "abc123",
      });

      const meta = store.getIndexMeta(projectId);
      expect(meta).not.toBeNull();
      expect(meta!.fileCount).toBe(100);
      expect(meta!.symbolCount).toBe(500);
      expect(meta!.gitHash).toBe("abc123");
    });

    it("should update existing meta on conflict", () => {
      store.upsertIndexMeta({
        projectId,
        lastIndexed: "2025-01-01T00:00:00Z",
        fileCount: 50,
        symbolCount: 200,
        relationCount: 400,
      });

      store.upsertIndexMeta({
        projectId,
        lastIndexed: "2025-01-02T00:00:00Z",
        fileCount: 100,
        symbolCount: 500,
        relationCount: 1200,
        gitHash: "def456",
      });

      const meta = store.getIndexMeta(projectId);
      expect(meta!.fileCount).toBe(100);
      expect(meta!.gitHash).toBe("def456");
    });
  });

  // ── Module Paths ─────────────────────────────

  describe("getModulePaths", () => {
    it("should return distinct module paths", () => {
      store.insertSymbol({ projectId, name: "a", kind: "function", file: "src/core/a.ts", startLine: 1, endLine: 5, exported: true, modulePath: "core" });
      store.insertSymbol({ projectId, name: "b", kind: "function", file: "src/core/b.ts", startLine: 1, endLine: 5, exported: true, modulePath: "core" });
      store.insertSymbol({ projectId, name: "c", kind: "function", file: "src/api/c.ts", startLine: 1, endLine: 5, exported: true, modulePath: "api" });

      const paths = store.getModulePaths(projectId);
      expect(paths).toEqual(["api", "core"]);
    });
  });
});
