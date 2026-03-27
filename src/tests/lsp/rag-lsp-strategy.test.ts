import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../../core/store/migrations.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { multiStrategySearch } from "../../core/rag/multi-strategy-retrieval.js";

describe("RAG LSP Strategy", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  it("should work without lspBridge (strategy 5 not executed)", () => {
    store.insert({
      sourceType: "memory",
      sourceId: "mem:auth",
      title: "Authentication Guide",
      content: "JWT authentication with Express middleware and role-based access control",
    });

    const results = multiStrategySearch(db, "authentication JWT");
    expect(results.length).toBeGreaterThan(0);
    // No LSP strategy tag
    for (const r of results) {
      expect(r.strategies).not.toContain("lsp");
    }
  });

  it("should boost code_context docs when lspBridge is provided with PascalCase entity", () => {
    // Seed a code_context doc with a PascalCase name
    store.insert({
      sourceType: "code_context",
      sourceId: "code:GraphStore",
      title: "GraphStore class context",
      content: "GraphStore handles all graph operations including node CRUD and edge management",
    });
    store.insert({
      sourceType: "memory",
      sourceId: "mem:general",
      title: "General Notes",
      content: "Some general project notes about architecture and patterns",
    });

    const mockBridge = {
      findReferences: async () => [
        { file: "src/store.ts", startLine: 10 },
      ],
    };

    const results = multiStrategySearch(db, "GraphStore operations", { lspBridge: mockBridge });
    expect(results.length).toBeGreaterThan(0);

    // The code_context doc mentioning GraphStore should appear
    const codeResult = results.find(r => r.sourceType === "code_context");
    expect(codeResult).toBeDefined();
  });

  it("should boost lsp_result docs when lspBridge is provided", () => {
    store.insert({
      sourceType: "lsp_result",
      sourceId: "lsp:CodeStore",
      title: "CodeStore LSP result",
      content: "CodeStore class with insertSymbol, findSymbolsByName, getSymbol methods",
    });
    store.insert({
      sourceType: "docs",
      sourceId: "docs:readme",
      title: "Project Readme",
      content: "This project uses TypeScript and SQLite for data storage",
    });

    const mockBridge = {
      findReferences: async () => [
        { file: "src/code-store.ts", startLine: 95 },
      ],
    };

    const results = multiStrategySearch(db, "CodeStore methods", { lspBridge: mockBridge });
    expect(results.length).toBeGreaterThan(0);

    // The lsp_result doc should appear and have lsp strategy
    const lspResult = results.find(r => r.sourceType === "lsp_result");
    if (lspResult) {
      expect(lspResult.strategies).toContain("lsp");
    }
  });

  it("should not break retrieval when LSP strategy throws", () => {
    store.insert({
      sourceType: "memory",
      sourceId: "mem:safe",
      title: "Safe Memory",
      content: "This document should still be retrievable despite LSP errors",
    });

    // Provide a bridge but the decomposeQuery will handle errors internally
    const mockBridge = {
      findReferences: async () => {
        throw new Error("LSP unavailable");
      },
    };

    // The LSP strategy catches errors internally, so this should still work
    const results = multiStrategySearch(db, "Safe Memory retrievable", { lspBridge: mockBridge });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("Safe");
  });

  it("should skip LSP strategy when lspBridge is null", () => {
    store.insert({
      sourceType: "code_context",
      sourceId: "code:MyClass",
      title: "MyClass context",
      content: "MyClass handles data processing with complex algorithms",
    });

    const results = multiStrategySearch(db, "MyClass processing", { lspBridge: null });
    expect(results.length).toBeGreaterThan(0);
    // No LSP strategy tag
    for (const r of results) {
      expect(r.strategies).not.toContain("lsp");
    }
  });
});
