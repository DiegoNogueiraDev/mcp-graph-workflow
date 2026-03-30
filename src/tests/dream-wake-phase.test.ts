import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { runWakeReadyPhase } from "../core/dream/phases/wake-ready-phase.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function insertTestDoc(db: Database.Database, id: string, qualityScore: number, content: string = "Test content"): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, chunk_index, created_at, updated_at, quality_score, usage_count)
    VALUES (?, 'memory', ?, ?, ?, ?, 0, ?, ?, ?, 0)
  `).run(id, `src_${id}`, `Doc ${id}`, content, `hash_${id}`, now, now, qualityScore);
}

describe("wake-ready-phase", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("should calculate capacity report with docs and freed tokens", () => {
    insertTestDoc(db, "d1", 0.5, "Hello world content here");
    insertTestDoc(db, "d2", 0.8, "Another document with content");

    const result = runWakeReadyPhase(db, { totalDocsBefore: 5, avgQualityBefore: 0.4 });
    expect(result.freedTokens).toBeGreaterThanOrEqual(0);
    expect(result.signalToNoise).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should compute signal-to-noise ratio correctly", () => {
    insertTestDoc(db, "d1", 0.7);
    insertTestDoc(db, "d2", 0.9);

    // avgQualityBefore was lower, current avg should be higher
    const result = runWakeReadyPhase(db, { totalDocsBefore: 2, avgQualityBefore: 0.3 });
    expect(result.signalToNoise).toBeGreaterThan(1); // improved
  });

  it("should handle empty knowledge store gracefully", () => {
    const result = runWakeReadyPhase(db, { totalDocsBefore: 0, avgQualityBefore: 0 });
    expect(result.freedTokens).toBe(0);
    expect(result.signalToNoise).toBe(0);
    expect(result.newGeneralizations).toBe(0);
  });

  it("should return valid WakeReadyResult shape", () => {
    insertTestDoc(db, "d1", 0.5);

    const result = runWakeReadyPhase(db, { totalDocsBefore: 3, avgQualityBefore: 0.4 });
    expect(result).toHaveProperty("freedTokens");
    expect(result).toHaveProperty("signalToNoise");
    expect(result).toHaveProperty("newGeneralizations");
    expect(result).toHaveProperty("durationMs");
  });
});
