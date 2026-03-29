/**
 * Translation Memory — tracks accepted/corrected translations for rule ranking.
 *
 * Records which rule/template/AI choice was accepted or corrected.
 * Accepted translations boost confidence; corrected ones reduce it.
 * Queryable by construct + language pair.
 *
 * Persisted to SQLite with an in-memory Map cache for fast reads.
 */

import type Database from "better-sqlite3";
import { now } from "../../utils/time.js";

// ── Types ──────────────────────────────────────────

export interface MemoryEntry {
  constructId: string;
  sourceLanguage: string;
  targetLanguage: string;
  ruleId: string;
  accepted: boolean;
  confidence: number;
  correctionReason?: string;
  timestamp: string;
}

export interface AcceptedInput {
  constructId: string;
  sourceLanguage: string;
  targetLanguage: string;
  ruleId: string;
  confidence: number;
}

export interface CorrectedInput {
  constructId: string;
  sourceLanguage: string;
  targetLanguage: string;
  ruleId: string;
  originalConfidence: number;
  correctionReason: string;
}

export interface MemoryStats {
  totalEntries: number;
  accepted: number;
  corrected: number;
}

interface DbRow {
  id: string;
  construct_id: string;
  source_language: string;
  target_language: string;
  correction_count: number;
  acceptance_count: number;
  confidence_boost: number;
  created_at: string;
  updated_at: string;
}

// ── Translation Memory ─────────────────────────────

export class TranslationMemory {
  private entries: MemoryEntry[] = [];
  private boostCache = new Map<string, number>();
  private readonly db: Database.Database | undefined;

  constructor(db?: Database.Database) {
    this.db = db;
    if (this.db) {
      this.initTable();
      this.loadFromDb();
    }
  }

  private initTable(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS translation_memory (
        id TEXT PRIMARY KEY,
        construct_id TEXT NOT NULL,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        correction_count INTEGER DEFAULT 0,
        acceptance_count INTEGER DEFAULT 0,
        confidence_boost REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  private loadFromDb(): void {
    if (!this.db) return;
    const rows = this.db.prepare("SELECT * FROM translation_memory").all() as DbRow[];
    for (const row of rows) {
      this.boostCache.set(row.id, row.confidence_boost);
    }
  }

  private makeId(constructId: string, sourceLanguage: string, targetLanguage: string): string {
    return `${constructId}:${sourceLanguage}:${targetLanguage}`;
  }

  /**
   * Record an accepted translation (positive signal).
   */
  recordAccepted(input: AcceptedInput): void {
    this.entries.push({
      constructId: input.constructId,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      ruleId: input.ruleId,
      accepted: true,
      confidence: input.confidence,
      timestamp: now(),
    });

    if (this.db) {
      const id = this.makeId(input.constructId, input.sourceLanguage, input.targetLanguage);
      const timestamp = now();
      this.db.prepare(`
        INSERT INTO translation_memory (id, construct_id, source_language, target_language, acceptance_count, confidence_boost, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, 0.05, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          acceptance_count = acceptance_count + 1,
          confidence_boost = confidence_boost + 0.05,
          updated_at = ?
      `).run(id, input.constructId, input.sourceLanguage, input.targetLanguage, timestamp, timestamp, timestamp);

      const row = this.db.prepare("SELECT confidence_boost FROM translation_memory WHERE id = ?").get(id) as { confidence_boost: number } | undefined;
      if (row) this.boostCache.set(id, row.confidence_boost);
    }
  }

  /**
   * Record a corrected translation (negative signal).
   */
  recordCorrected(input: CorrectedInput): void {
    this.entries.push({
      constructId: input.constructId,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      ruleId: input.ruleId,
      accepted: false,
      confidence: input.originalConfidence,
      correctionReason: input.correctionReason,
      timestamp: now(),
    });

    if (this.db) {
      const id = this.makeId(input.constructId, input.sourceLanguage, input.targetLanguage);
      const timestamp = now();
      this.db.prepare(`
        INSERT INTO translation_memory (id, construct_id, source_language, target_language, correction_count, confidence_boost, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, -0.1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          correction_count = correction_count + 1,
          confidence_boost = confidence_boost - 0.1,
          updated_at = ?
      `).run(id, input.constructId, input.sourceLanguage, input.targetLanguage, timestamp, timestamp, timestamp);

      const row = this.db.prepare("SELECT confidence_boost FROM translation_memory WHERE id = ?").get(id) as { confidence_boost: number } | undefined;
      if (row) this.boostCache.set(id, row.confidence_boost);
    }
  }

  /**
   * Query entries by construct + language pair.
   * Uses DB if available, falls back to in-memory entries.
   */
  query(constructId: string, sourceLanguage: string, targetLanguage: string): MemoryEntry[] {
    return this.entries.filter(
      (e) =>
        e.constructId === constructId &&
        e.sourceLanguage === sourceLanguage &&
        e.targetLanguage === targetLanguage,
    );
  }

  /**
   * Get confidence boost for a rule based on historical acceptance/correction.
   * Positive = rule works well. Negative = rule has been corrected.
   *
   * When DB is available, reads aggregated boost from DB via cache.
   * Falls back to computing from in-memory entries.
   */
  getConfidenceBoost(ruleId: string): number {
    // Check DB cache first (keyed by construct:source:target)
    const cachedBoost = this.boostCache.get(ruleId);
    if (cachedBoost !== undefined) return cachedBoost;

    // Fall back to in-memory calculation
    const ruleEntries = this.entries.filter((e) => e.ruleId === ruleId);
    if (ruleEntries.length === 0) return 0;

    let boost = 0;
    for (const entry of ruleEntries) {
      if (entry.accepted) {
        boost += 0.05; // small positive boost per acceptance
      } else {
        boost -= 0.1; // larger negative boost per correction
      }
    }

    return boost;
  }

  /**
   * Get all entries.
   */
  getAllEntries(): MemoryEntry[] {
    return [...this.entries];
  }

  /**
   * Get statistics.
   * When DB is available, reads aggregated counts from DB.
   */
  getStats(): MemoryStats {
    if (this.db) {
      const row = this.db.prepare(`
        SELECT
          COALESCE(SUM(acceptance_count + correction_count), 0) AS total,
          COALESCE(SUM(acceptance_count), 0) AS accepted,
          COALESCE(SUM(correction_count), 0) AS corrected
        FROM translation_memory
      `).get() as { total: number; accepted: number; corrected: number };
      return {
        totalEntries: row.total,
        accepted: row.accepted,
        corrected: row.corrected,
      };
    }

    return {
      totalEntries: this.entries.length,
      accepted: this.entries.filter((e) => e.accepted).length,
      corrected: this.entries.filter((e) => !e.accepted).length,
    };
  }
}
