import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("Knowledge Stats Queries", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  it("should count documents by source type", () => {
    store.insert({ sourceType: "memory", sourceId: "m1", title: "M1", content: "Memory one" });
    store.insert({ sourceType: "memory", sourceId: "m2", title: "M2", content: "Memory two" });
    store.insert({ sourceType: "docs", sourceId: "d1", title: "D1", content: "Docs one" });

    const counts = db
      .prepare("SELECT source_type, COUNT(*) as count FROM knowledge_documents GROUP BY source_type")
      .all() as Array<{ source_type: string; count: number }>;

    const memCount = counts.find((c) => c.source_type === "memory");
    const docsCount = counts.find((c) => c.source_type === "docs");

    expect(memCount?.count).toBe(2);
    expect(docsCount?.count).toBe(1);
  });

  it("should query quality distribution", () => {
    store.insert({ sourceType: "memory", sourceId: "q1", title: "Q1", content: "Quality test one" });
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.9 WHERE source_id = 'q1'").run();

    store.insert({ sourceType: "memory", sourceId: "q2", title: "Q2", content: "Quality test two" });
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.3 WHERE source_id = 'q2'").run();

    const dist = db
      .prepare(
        `SELECT
          CASE
            WHEN quality_score >= 0.8 THEN 'high'
            WHEN quality_score >= 0.5 THEN 'medium'
            ELSE 'low'
          END as tier,
          COUNT(*) as count
        FROM knowledge_documents
        GROUP BY tier`,
      )
      .all() as Array<{ tier: string; count: number }>;

    expect(dist.find((d) => d.tier === "high")?.count).toBe(1);
    expect(dist.find((d) => d.tier === "low")?.count).toBe(1);
  });

  it("should track top accessed documents", () => {
    const doc = store.insert({ sourceType: "memory", sourceId: "acc1", title: "Accessed", content: "Much accessed doc" });
    db.prepare("UPDATE knowledge_documents SET usage_count = 10, last_accessed_at = ? WHERE id = ?")
      .run(new Date().toISOString(), doc.id);

    const top = db
      .prepare("SELECT id, usage_count FROM knowledge_documents WHERE usage_count > 0 ORDER BY usage_count DESC LIMIT 5")
      .all() as Array<{ id: string; usage_count: number }>;

    expect(top).toHaveLength(1);
    expect(top[0].usage_count).toBe(10);
  });

  it("should report staleness distribution", () => {
    store.insert({ sourceType: "memory", sourceId: "s1", title: "Fresh", content: "Fresh doc" });
    store.insert({ sourceType: "memory", sourceId: "s2", title: "Stale", content: "Stale doc" });
    db.prepare("UPDATE knowledge_documents SET staleness_days = 100 WHERE source_id = 's2'").run();

    const staleness = db
      .prepare(
        `SELECT
          COUNT(CASE WHEN staleness_days = 0 THEN 1 END) as fresh,
          COUNT(CASE WHEN staleness_days > 90 THEN 1 END) as stale
        FROM knowledge_documents`,
      )
      .get() as { fresh: number; stale: number };

    expect(staleness.fresh).toBe(1);
    expect(staleness.stale).toBe(1);
  });
});
