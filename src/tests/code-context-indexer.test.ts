import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexCodeAnalysis } from "../core/rag/code-context-indexer.js";

describe("Code Context Indexer", () => {
  let db: Database.Database;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    knowledgeStore = new KnowledgeStore(db);
  });

  it("should index code symbols as knowledge", () => {
    const result = indexCodeAnalysis(knowledgeStore, {
      symbols: [
        { name: "buildTaskContext", kind: "function", file: "src/core/context/compact-context.ts", exported: true },
        { name: "KnowledgeStore", kind: "class", file: "src/core/store/knowledge-store.ts", exported: true },
      ],
      flows: [],
    });

    expect(result.documentsIndexed).toBeGreaterThan(0);
    const docs = knowledgeStore.list({ sourceType: "code_context" });
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].content).toContain("buildTaskContext");
  });

  it("should index process flows", () => {
    const result = indexCodeAnalysis(knowledgeStore, {
      symbols: [],
      flows: [
        {
          name: "CLI import flow",
          steps: ["import-prd.ts → prd-to-graph.ts → sqlite-store.ts"],
        },
      ],
    });

    expect(result.documentsIndexed).toBeGreaterThan(0);
    const docs = knowledgeStore.list({ sourceType: "code_context" });
    expect(docs.some((d) => d.content.includes("CLI import flow"))).toBe(true);
  });

  it("should include metadata with counts", () => {
    indexCodeAnalysis(knowledgeStore, {
      symbols: [
        { name: "foo", kind: "function", file: "a.ts", exported: true },
      ],
      flows: [],
    });

    const docs = knowledgeStore.list({ sourceType: "code_context" });
    expect(docs[0].metadata?.symbolCount).toBe(1);
  });
});
