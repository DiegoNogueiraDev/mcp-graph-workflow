import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { CodeStore } from "../../core/code/code-store.js";
import { configureDb, runMigrations } from "../../core/store/migrations.js";
import { getSymbolContextSemantic } from "../../core/code/graph-traversal.js";
import type { CodeSymbol } from "../../core/code/code-types.js";

describe("getSymbolContextSemantic", () => {
  let db: Database.Database;
  let store: CodeStore;
  const projectId = "proj_lsp_test";

  let symA: CodeSymbol;
  let symB: CodeSymbol;
  let symC: CodeSymbol;
  let _symExternal: CodeSymbol;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new CodeStore(db);

    const mkSym = (
      name: string,
      file: string,
      startLine: number,
      endLine: number,
      kind: CodeSymbol["kind"] = "function",
    ): CodeSymbol =>
      store.insertSymbol({ projectId, name, kind, file, startLine, endLine, exported: true });

    symA = mkSym("functionA", "src/a.ts", 1, 10);
    symB = mkSym("functionB", "src/b.ts", 1, 20);
    symC = mkSym("functionC", "src/c.ts", 5, 15);
    _symExternal = mkSym("externalHelper", "src/external.ts", 1, 30);

    // A calls B
    store.insertRelation({ projectId, fromSymbol: symA.id, toSymbol: symB.id, type: "calls", file: "src/a.ts", line: 5 });
    // B calls C
    store.insertRelation({ projectId, fromSymbol: symB.id, toSymbol: symC.id, type: "calls", file: "src/b.ts", line: 10 });
  });

  afterEach(() => {
    db.close();
  });

  it("should return AST context when no bridge provided (null)", async () => {
    const result = await getSymbolContextSemantic(store, "functionA", projectId, null);

    expect(result.lspEnriched).toBe(false);
    expect(result.symbols.length).toBeGreaterThan(0);
    const names = result.symbols.map(s => s.name);
    expect(names).toContain("functionA");
    expect(names).toContain("functionB");
  });

  it("should return AST context when no bridge provided (undefined)", async () => {
    const result = await getSymbolContextSemantic(store, "functionA", projectId);

    expect(result.lspEnriched).toBe(false);
    expect(result.symbols.length).toBeGreaterThan(0);
  });

  it("should return enriched context when bridge finds new references", async () => {
    const mockBridge = {
      findReferences: async (_file: string, _line: number, _character: number) => [
        { file: "src/external.ts", startLine: 5, startCharacter: 0, endLine: 5, endCharacter: 10 },
      ],
    };

    const result = await getSymbolContextSemantic(store, "functionA", projectId, mockBridge);

    expect(result.lspEnriched).toBe(true);
    const names = result.symbols.map(s => s.name);
    // Should include both AST context and LSP-discovered symbol
    expect(names).toContain("functionA");
    expect(names).toContain("externalHelper");
  });

  it("should gracefully degrade on LSP error", async () => {
    const mockBridge = {
      findReferences: async () => {
        throw new Error("LSP server crashed");
      },
    };

    const result = await getSymbolContextSemantic(store, "functionA", projectId, mockBridge);

    expect(result.lspEnriched).toBe(false);
    // Still returns AST context
    expect(result.symbols.length).toBeGreaterThan(0);
    const names = result.symbols.map(s => s.name);
    expect(names).toContain("functionA");
  });

  it("should return lspEnriched=false when symbol not found in store", async () => {
    const mockBridge = {
      findReferences: async () => [
        { file: "src/external.ts", startLine: 5, startCharacter: 0, endLine: 5, endCharacter: 10 },
      ],
    };

    const result = await getSymbolContextSemantic(store, "nonExistentSymbol", projectId, mockBridge);

    expect(result.lspEnriched).toBe(false);
    expect(result.symbols).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
  });

  it("should not duplicate symbols already present in AST context", async () => {
    // Bridge returns a reference in a file that already has a symbol in AST context
    const mockBridge = {
      findReferences: async () => [
        // Reference in same file as symB which is already in AST context for functionA
        { file: "src/b.ts", startLine: 5, startCharacter: 0, endLine: 5, endCharacter: 10 },
      ],
    };

    const result = await getSymbolContextSemantic(store, "functionA", projectId, mockBridge);

    // lspEnriched is true because LSP refs were found, even if no NEW symbols added
    expect(result.lspEnriched).toBe(true);
    // Count occurrences of functionB — should appear only once
    const bCount = result.symbols.filter(s => s.name === "functionB").length;
    expect(bCount).toBe(1);
  });

  it("should return lspEnriched=false when bridge returns empty refs", async () => {
    const mockBridge = {
      findReferences: async () => [] as Array<{ file: string; startLine: number; startCharacter: number; endLine: number; endCharacter: number }>,
    };

    const result = await getSymbolContextSemantic(store, "functionA", projectId, mockBridge);

    expect(result.lspEnriched).toBe(false);
  });
});
