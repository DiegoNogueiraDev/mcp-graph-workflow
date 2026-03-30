import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { runNremPhase } from "../core/dream/phases/nrem-phase.js";
import { listDreamArchive } from "../core/dream/dream-store.js";
import { DEFAULT_DREAM_CONFIG } from "../core/dream/dream-types.js";
import type { DreamCycleConfig } from "../core/dream/dream-types.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function insertTestDoc(
  db: Database.Database,
  id: string,
  opts: {
    qualityScore?: number;
    createdAt?: string;
    usageCount?: number;
    sourceType?: string;
    content?: string;
  } = {},
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, chunk_index, created_at, updated_at, quality_score, usage_count)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(
    id,
    opts.sourceType ?? "memory",
    `src_${id}`,
    `Test doc ${id}`,
    opts.content ?? "Test content for knowledge document",
    `hash_${id}`,
    opts.createdAt ?? now,
    now,
    opts.qualityScore ?? 0.5,
    opts.usageCount ?? 0,
  );
}

function insertDreamCycle(db: Database.Database, cycleId: string): void {
  db.prepare(`
    INSERT INTO dream_cycles (id, status, config, started_at)
    VALUES (?, 'running', '{}', ?)
  `).run(cycleId, new Date().toISOString());
}

describe("nrem-phase", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("replay", () => {
    it("should replay recent high-quality docs by updating last_accessed_at", () => {
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      insertTestDoc(db, "recent_good", { qualityScore: 0.8, createdAt: recentDate });
      insertTestDoc(db, "old_good", {
        qualityScore: 0.8,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago — not recent
      });

      const cycleId = "cycle_replay";
      insertDreamCycle(db, cycleId);

      const result = runNremPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result.replayed).toBeGreaterThanOrEqual(1);
    });
  });

  describe("decay", () => {
    it("should decay quality scores for all documents", () => {
      insertTestDoc(db, "doc_decay_1", { qualityScore: 0.7 });
      insertTestDoc(db, "doc_decay_2", { qualityScore: 0.3 });

      const cycleId = "cycle_decay";
      insertDreamCycle(db, cycleId);

      const result = runNremPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result.scoresDecayed).toBe(2);
    });
  });

  describe("prune", () => {
    // Note: decayStaleKnowledge recalculates quality_score from scratch.
    // To get low scores after decay, docs must be very old + minimal content + no usage.
    const veryOldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    it("should prune documents below threshold and archive them", () => {
      // Very old doc with minimal content → low quality after decay (~0.15-0.24)
      insertTestDoc(db, "doc_low", { qualityScore: 0.05, createdAt: veryOldDate, content: "x" });
      insertTestDoc(db, "doc_high", { qualityScore: 0.8, usageCount: 10 });

      const cycleId = "cycle_prune";
      insertDreamCycle(db, cycleId);

      // Use threshold 0.3 since source reliability alone contributes ~0.24
      const config: DreamCycleConfig = { ...DEFAULT_DREAM_CONFIG, pruneThreshold: 0.3 };
      const result = runNremPhase(db, config, cycleId);
      expect(result.pruned).toBeGreaterThanOrEqual(1);
      expect(result.archived).toBeGreaterThanOrEqual(1);

      const archives = listDreamArchive(db, cycleId);
      expect(archives.length).toBeGreaterThanOrEqual(1);
      expect(archives.some((a) => a.originalDocId === "doc_low")).toBe(true);
    });

    it("should not prune documents above threshold", () => {
      insertTestDoc(db, "doc_safe", { qualityScore: 0.5, usageCount: 5 });

      const cycleId = "cycle_no_prune";
      insertDreamCycle(db, cycleId);

      const result = runNremPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result.pruned).toBe(0);
    });

    it("should respect custom pruneThreshold", () => {
      // Both very old with minimal content → low quality
      insertTestDoc(db, "doc_mid", { qualityScore: 0.3, createdAt: veryOldDate, content: "y" });
      insertTestDoc(db, "doc_low2", { qualityScore: 0.1, createdAt: veryOldDate, content: "z" });

      const cycleId = "cycle_custom_threshold";
      insertDreamCycle(db, cycleId);

      // High threshold to catch both docs after decay
      const config: DreamCycleConfig = { ...DEFAULT_DREAM_CONFIG, pruneThreshold: 0.5 };
      const result = runNremPhase(db, config, cycleId);
      expect(result.pruned).toBe(2);
    });
  });

  describe("result shape", () => {
    it("should return valid NremPhaseResult with all counters", () => {
      insertTestDoc(db, "doc_shape", { qualityScore: 0.5 });

      const cycleId = "cycle_shape";
      insertDreamCycle(db, cycleId);

      const result = runNremPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result).toHaveProperty("replayed");
      expect(result).toHaveProperty("scoresDecayed");
      expect(result).toHaveProperty("pruned");
      expect(result).toHaveProperty("archived");
      expect(result).toHaveProperty("durationMs");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("dry run", () => {
    it("should not actually delete docs in dry run mode", () => {
      const veryOld = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      insertTestDoc(db, "doc_dryrun", { qualityScore: 0.05, createdAt: veryOld, content: "x" });

      const cycleId = "cycle_dryrun";
      insertDreamCycle(db, cycleId);

      const config: DreamCycleConfig = { ...DEFAULT_DREAM_CONFIG, dryRun: true, pruneThreshold: 0.3 };
      const result = runNremPhase(db, config, cycleId);
      expect(result.pruned).toBeGreaterThanOrEqual(1);

      // Doc should still exist in dry run
      const doc = db.prepare("SELECT id FROM knowledge_documents WHERE id = ?").get("doc_dryrun");
      expect(doc).toBeDefined();
    });
  });
});
