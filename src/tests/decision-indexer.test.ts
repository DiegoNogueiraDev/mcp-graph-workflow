import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexDecision } from "../core/rag/decision-indexer.js";

describe("Decision Indexer", () => {
  let db: Database.Database;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    knowledgeStore = new KnowledgeStore(db);
  });

  it("should index a decision with rationale", () => {
    const result = indexDecision(knowledgeStore, {
      nodeId: "node_abc",
      title: "Implement JWT auth",
      rationale: "Used jsonwebtoken library with RS256 because it supports key rotation",
      tags: ["auth", "jwt"],
    });

    expect(result.documentsIndexed).toBe(1);
    const docs = knowledgeStore.list({ sourceType: "ai_decision" });
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("jsonwebtoken");
    expect(docs[0].metadata?.nodeId).toBe("node_abc");
  });

  it("should include tags in metadata", () => {
    indexDecision(knowledgeStore, {
      nodeId: "node_def",
      title: "Setup database",
      rationale: "Chose SQLite for simplicity and local-first architecture",
      tags: ["database", "sqlite"],
    });

    const docs = knowledgeStore.list({ sourceType: "ai_decision" });
    expect(docs[0].metadata?.tags).toEqual(["database", "sqlite"]);
  });

  it("should deduplicate identical decisions", () => {
    const decision = {
      nodeId: "node_1",
      title: "Task A",
      rationale: "Exactly the same rationale content",
      tags: [],
    };

    indexDecision(knowledgeStore, decision);
    indexDecision(knowledgeStore, decision);

    const docs = knowledgeStore.list({ sourceType: "ai_decision" });
    expect(docs).toHaveLength(1);
  });

  it("should use ai_decision as source type", () => {
    indexDecision(knowledgeStore, {
      nodeId: "node_x",
      title: "Task X",
      rationale: "Some learning",
      tags: [],
    });

    expect(knowledgeStore.count("ai_decision")).toBe(1);
  });
});
