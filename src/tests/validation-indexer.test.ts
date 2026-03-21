import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexAcValidationResult } from "../core/rag/validation-indexer.js";

describe("Validation Indexer", () => {
  let db: Database.Database;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    knowledgeStore = new KnowledgeStore(db);
  });

  it("should index AC validation results", () => {
    const result = indexAcValidationResult(knowledgeStore, {
      nodeId: "node_abc",
      acResults: [
        { criterion: "User can log in", passed: true },
        { criterion: "Error shown on invalid input", passed: false, reason: "No validation shown" },
      ],
      overallScore: 0.5,
    });

    expect(result.documentsIndexed).toBe(1);
    const docs = knowledgeStore.list({ sourceType: "validation_result" });
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("User can log in");
    expect(docs[0].metadata?.nodeId).toBe("node_abc");
    expect(docs[0].metadata?.passRate).toBe(0.5);
  });

  it("should include pass rate in metadata", () => {
    indexAcValidationResult(knowledgeStore, {
      nodeId: "node_x",
      acResults: [
        { criterion: "AC1", passed: true },
        { criterion: "AC2", passed: true },
      ],
      overallScore: 1.0,
    });

    const docs = knowledgeStore.list({ sourceType: "validation_result" });
    expect(docs[0].metadata?.passRate).toBe(1.0);
    expect(docs[0].metadata?.acCount).toBe(2);
  });
});
