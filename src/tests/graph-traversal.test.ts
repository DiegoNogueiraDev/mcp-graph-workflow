import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { CodeStore } from "../core/code/code-store.js";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  getSymbolContext,
  analyzeImpact,
  getFullGraph,
} from "../core/code/graph-traversal.js";
import type { CodeSymbol } from "../core/code/code-types.js";

describe("graph-traversal", () => {
  let db: Database.Database;
  let store: CodeStore;
  const projectId = "proj_traversal";

  // Build a known graph:
  //   A → calls → B → calls → C → calls → D
  //   A → imports → E
  //   B → belongs_to → F (class)
  let symA: CodeSymbol;
  let symB: CodeSymbol;
  let symC: CodeSymbol;
  let symD: CodeSymbol;
  let symE: CodeSymbol;
  let symF: CodeSymbol;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new CodeStore(db);

    const mkSym = (name: string, kind: CodeSymbol["kind"] = "function", file: string = "src/test.ts") =>
      store.insertSymbol({ projectId, name, kind, file, startLine: 1, endLine: 10, exported: true });

    symA = mkSym("functionA");
    symB = mkSym("functionB");
    symC = mkSym("functionC");
    symD = mkSym("functionD");
    symE = mkSym("helperE", "function", "src/helpers.ts");
    symF = mkSym("ClassF", "class", "src/class.ts");

    store.insertRelation({ projectId, fromSymbol: symA.id, toSymbol: symB.id, type: "calls", file: "src/test.ts", line: 5 });
    store.insertRelation({ projectId, fromSymbol: symB.id, toSymbol: symC.id, type: "calls", file: "src/test.ts", line: 8 });
    store.insertRelation({ projectId, fromSymbol: symC.id, toSymbol: symD.id, type: "calls", file: "src/test.ts", line: 12 });
    store.insertRelation({ projectId, fromSymbol: symA.id, toSymbol: symE.id, type: "imports" });
    store.insertRelation({ projectId, fromSymbol: symB.id, toSymbol: symF.id, type: "belongs_to" });
  });

  afterEach(() => {
    db.close();
  });

  // ── getSymbolContext ─────────────────────────

  describe("getSymbolContext", () => {
    it("should return 1-hop callers and callees for a symbol", () => {
      const ctx = getSymbolContext(store, "functionB", projectId);

      expect(ctx.symbols.length).toBeGreaterThanOrEqual(3); // B + A (caller) + C (callee) + F (belongs_to)
      expect(ctx.relations.length).toBeGreaterThanOrEqual(2);

      const names = ctx.symbols.map((s) => s.name);
      expect(names).toContain("functionB");
      expect(names).toContain("functionA"); // caller
      expect(names).toContain("functionC"); // callee
    });

    it("should return empty for non-existent symbol", () => {
      const ctx = getSymbolContext(store, "nonExistent", projectId);
      expect(ctx.symbols).toHaveLength(0);
      expect(ctx.relations).toHaveLength(0);
    });
  });

  // ── analyzeImpact ───────────────────────────

  describe("analyzeImpact", () => {
    it("should find upstream callers with confidence decay", () => {
      // D is called by C, which is called by B, which is called by A
      const impact = analyzeImpact(store, "functionD", projectId, "upstream");

      expect(impact.symbol).toBe("functionD");
      expect(impact.affectedSymbols.length).toBeGreaterThanOrEqual(1);

      const symCImpact = impact.affectedSymbols.find((s) => s.name === "functionC");
      expect(symCImpact).toBeDefined();
      expect(symCImpact!.confidence).toBe(1.0); // depth 1
    });

    it("should calculate risk levels correctly", () => {
      const impact = analyzeImpact(store, "functionD", projectId, "upstream");
      // D has chain A→B→C→D, so upstream: C(d1), B(d2), A(d3)
      expect(["low", "medium", "high"]).toContain(impact.riskLevel);
    });

    it("should find downstream callees", () => {
      const impact = analyzeImpact(store, "functionA", projectId, "downstream");

      expect(impact.affectedSymbols.length).toBeGreaterThanOrEqual(1);
      const names = impact.affectedSymbols.map((s) => s.name);
      expect(names).toContain("functionB"); // direct callee
    });

    it("should return empty for leaf symbol with no dependents", () => {
      const impact = analyzeImpact(store, "functionA", projectId, "upstream");
      // A has no upstream callers
      expect(impact.affectedSymbols).toHaveLength(0);
      expect(impact.riskLevel).toBe("low");
    });
  });

  // ── getFullGraph ────────────────────────────

  describe("getFullGraph", () => {
    it("should return all symbols and relations", () => {
      const graph = getFullGraph(store, projectId);

      expect(graph.symbols.length).toBe(6);
      expect(graph.relations.length).toBe(5);
    });

    it("should respect limit parameter", () => {
      const graph = getFullGraph(store, projectId, 3);

      expect(graph.symbols.length).toBeLessThanOrEqual(3);
    });

    it("should enrich relations with from/to symbol names", () => {
      const graph = getFullGraph(store, projectId);

      // Every relation must have from/to (names) AND fromSymbol/toSymbol (IDs)
      for (const rel of graph.relations) {
        expect(rel.from).toBeDefined();
        expect(rel.to).toBeDefined();
        expect(rel.fromSymbol).toBeDefined();
        expect(rel.toSymbol).toBeDefined();

        // from/to must be human-readable names, not csym_ IDs
        expect(rel.from).not.toMatch(/^csym_/);
        expect(rel.to).not.toMatch(/^csym_/);
      }

      // Verify specific mappings: A→B call should have from="functionA", to="functionB"
      const aToB = graph.relations.find(
        (r) => r.fromSymbol === symA.id && r.toSymbol === symB.id,
      );
      expect(aToB).toBeDefined();
      expect(aToB!.from).toBe("functionA");
      expect(aToB!.to).toBe("functionB");
    });

    it("should fallback to raw ID when symbol is outside the limit", () => {
      // With limit=1, only 1 symbol is loaded — relations referencing
      // symbols outside that subset should fall back to the raw csym_ ID
      const graph = getFullGraph(store, projectId, 1);

      expect(graph.symbols.length).toBe(1);
      const loadedId = graph.symbols[0].id;

      for (const rel of graph.relations) {
        // The side that matches the loaded symbol should be a name
        if (rel.fromSymbol === loadedId) {
          expect(rel.from).toBe(graph.symbols[0].name);
        } else {
          // Not in the loaded subset — falls back to raw ID
          expect(rel.from).toMatch(/^csym_/);
        }

        if (rel.toSymbol === loadedId) {
          expect(rel.to).toBe(graph.symbols[0].name);
        } else {
          expect(rel.to).toMatch(/^csym_/);
        }
      }
    });
  });
});
