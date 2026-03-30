import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { DreamEngine } from "../core/dream/dream-engine.js";
import { getDreamCycle } from "../core/dream/dream-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function insertTestDoc(db: Database.Database, id: string, qualityScore: number): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, chunk_index, created_at, updated_at, quality_score, usage_count)
    VALUES (?, 'memory', ?, ?, 'Test content for knowledge document that has some length', ?, 0, ?, ?, ?, 0)
  `).run(id, `src_${id}`, `Doc ${id}`, `hash_${id}`, now, now, qualityScore);
}

describe("DreamEngine", () => {
  let db: Database.Database;
  let eventBus: GraphEventBus;
  let engine: DreamEngine;

  beforeEach(() => {
    db = createTestDb();
    eventBus = new GraphEventBus();
    engine = new DreamEngine(db, eventBus);
  });

  it("should execute NREM → REM → Wake sequentially", async () => {
    insertTestDoc(db, "d1", 0.5);
    insertTestDoc(db, "d2", 0.7);

    const result = await engine.runCycle();
    expect(result.status).toBe("completed");
    expect(result.phases.nrem).toBeDefined();
    expect(result.phases.rem).toBeDefined();
    expect(result.phases.wakeReady).toBeDefined();
  });

  it("should emit dream events via GraphEventBus", async () => {
    insertTestDoc(db, "d1", 0.5);

    const events: string[] = [];
    eventBus.on("dream:cycle_started", () => events.push("cycle_started"));
    eventBus.on("dream:phase_started", () => events.push("phase_started"));
    eventBus.on("dream:phase_completed", () => events.push("phase_completed"));
    eventBus.on("dream:cycle_completed", () => events.push("cycle_completed"));

    await engine.runCycle();

    expect(events).toContain("cycle_started");
    expect(events).toContain("cycle_completed");
    expect(events.filter((e) => e === "phase_started").length).toBe(3);
    expect(events.filter((e) => e === "phase_completed").length).toBe(3);
  });

  it("should persist DreamCycleResult via dream-store", async () => {
    insertTestDoc(db, "d1", 0.5);

    const result = await engine.runCycle();
    const persisted = getDreamCycle(db, result.id);

    expect(persisted).not.toBeNull();
    expect(persisted!.status).toBe("completed");
    expect(persisted!.phases.nrem.scoresDecayed).toBeGreaterThanOrEqual(0);
  });

  it("should support dry-run mode without mutations", async () => {
    insertTestDoc(db, "d1", 0.5);

    const countBefore = (db.prepare("SELECT COUNT(*) as cnt FROM knowledge_documents").get() as { cnt: number }).cnt;

    const result = await engine.runCycle({ dryRun: true });
    expect(result.status).toBe("completed");

    const countAfter = (db.prepare("SELECT COUNT(*) as cnt FROM knowledge_documents").get() as { cnt: number }).cnt;
    expect(countAfter).toBe(countBefore);
  });

  it("should return running status during cycle", async () => {
    insertTestDoc(db, "d1", 0.5);

    const statusBefore = engine.getStatus();
    expect(statusBefore.running).toBe(false);

    // Can't easily test mid-cycle status since it's synchronous,
    // but we verify the status shape
    await engine.runCycle();
    const statusAfter = engine.getStatus();
    expect(statusAfter.running).toBe(false);
  });

  it("should populate DreamSummary correctly", async () => {
    insertTestDoc(db, "d1", 0.4);
    insertTestDoc(db, "d2", 0.6);
    insertTestDoc(db, "d3", 0.8);

    const result = await engine.runCycle();
    expect(result.summary.totalDocsBefore).toBe(3);
    expect(result.summary.avgQualityBefore).toBeGreaterThan(0);
    expect(result.summary.totalDocsAfter).toBeGreaterThanOrEqual(0);
  });
});
