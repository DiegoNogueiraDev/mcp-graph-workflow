import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import {
  saveDreamCycle,
  updateDreamCycle,
  getDreamCycle,
  listDreamCycles,
  archiveDreamDoc,
  listDreamArchive,
} from "../core/dream/dream-store.js";
import { DEFAULT_DREAM_CONFIG } from "../core/dream/dream-types.js";
import type { DreamCycleResult } from "../core/dream/dream-types.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function makeCycleResult(overrides: Partial<DreamCycleResult> = {}): DreamCycleResult {
  return {
    id: "dream_test_001",
    startedAt: "2026-03-30T00:00:00.000Z",
    completedAt: "2026-03-30T00:01:00.000Z",
    status: "completed",
    config: DEFAULT_DREAM_CONFIG,
    phases: {
      nrem: { replayed: 10, scoresDecayed: 50, pruned: 3, archived: 3, durationMs: 500 },
      rem: { priorityProcessed: 2, urgencyDecayed: 1, merged: 1, clustersFormed: 0, associationsCreated: 4, durationMs: 800 },
      wakeReady: { freedTokens: 2000, signalToNoise: 1.15, newGeneralizations: 1, durationMs: 200 },
    },
    summary: {
      totalDocsBefore: 100,
      totalDocsAfter: 96,
      avgQualityBefore: 0.45,
      avgQualityAfter: 0.58,
      totalPruned: 3,
      totalMerged: 1,
      totalAssociations: 4,
      freedCapacityEstimate: 2000,
    },
    ...overrides,
  };
}

describe("dream-store", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("saveDreamCycle", () => {
    it("should persist a dream cycle", () => {
      const cycle = makeCycleResult();
      saveDreamCycle(db, cycle);

      const retrieved = getDreamCycle(db, "dream_test_001");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe("dream_test_001");
      expect(retrieved!.status).toBe("completed");
    });

    it("should store config and result as JSON", () => {
      const cycle = makeCycleResult();
      saveDreamCycle(db, cycle);

      const retrieved = getDreamCycle(db, "dream_test_001");
      expect(retrieved!.config).toEqual(DEFAULT_DREAM_CONFIG);
      expect(retrieved!.phases.nrem.replayed).toBe(10);
      expect(retrieved!.summary.totalPruned).toBe(3);
    });
  });

  describe("updateDreamCycle", () => {
    it("should update status and result of an existing cycle", () => {
      const cycle = makeCycleResult({ status: "running", completedAt: "" });
      saveDreamCycle(db, cycle);

      const updated = makeCycleResult({ status: "completed" });
      updateDreamCycle(db, updated);

      const retrieved = getDreamCycle(db, "dream_test_001");
      expect(retrieved!.status).toBe("completed");
      expect(retrieved!.completedAt).toBe("2026-03-30T00:01:00.000Z");
    });
  });

  describe("getDreamCycle", () => {
    it("should return null for non-existent cycle", () => {
      const result = getDreamCycle(db, "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("listDreamCycles", () => {
    it("should return all cycles ordered by started_at desc", () => {
      saveDreamCycle(db, makeCycleResult({ id: "dream_a", startedAt: "2026-03-29T00:00:00.000Z" }));
      saveDreamCycle(db, makeCycleResult({ id: "dream_b", startedAt: "2026-03-30T00:00:00.000Z" }));

      const cycles = listDreamCycles(db);
      expect(cycles).toHaveLength(2);
      expect(cycles[0].id).toBe("dream_b");
      expect(cycles[1].id).toBe("dream_a");
    });

    it("should support limit parameter", () => {
      saveDreamCycle(db, makeCycleResult({ id: "dream_1", startedAt: "2026-03-28T00:00:00.000Z" }));
      saveDreamCycle(db, makeCycleResult({ id: "dream_2", startedAt: "2026-03-29T00:00:00.000Z" }));
      saveDreamCycle(db, makeCycleResult({ id: "dream_3", startedAt: "2026-03-30T00:00:00.000Z" }));

      const cycles = listDreamCycles(db, 2);
      expect(cycles).toHaveLength(2);
    });
  });

  describe("archiveDreamDoc", () => {
    it("should archive a pruned document", () => {
      saveDreamCycle(db, makeCycleResult());

      archiveDreamDoc(db, {
        id: "archive_001",
        originalDocId: "doc_xyz",
        title: "Old knowledge doc",
        sourceType: "memory",
        qualityScore: 0.1,
        reason: "pruned",
        archivedAt: "2026-03-30T00:00:30.000Z",
        cycleId: "dream_test_001",
      });

      const archives = listDreamArchive(db, "dream_test_001");
      expect(archives).toHaveLength(1);
      expect(archives[0].originalDocId).toBe("doc_xyz");
      expect(archives[0].reason).toBe("pruned");
    });

    it("should archive a merged document", () => {
      saveDreamCycle(db, makeCycleResult());

      archiveDreamDoc(db, {
        id: "archive_002",
        originalDocId: "doc_abc",
        title: "Duplicate doc",
        sourceType: "ai_decision",
        qualityScore: 0.3,
        reason: "merged",
        archivedAt: "2026-03-30T00:00:45.000Z",
        cycleId: "dream_test_001",
      });

      const archives = listDreamArchive(db, "dream_test_001");
      expect(archives).toHaveLength(1);
      expect(archives[0].reason).toBe("merged");
    });
  });
});
