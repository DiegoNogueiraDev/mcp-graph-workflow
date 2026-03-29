/**
 * Knowledge Store — CRUD, FTS search, and dedup for knowledge_documents.
 * Follows DocsCacheStore pattern. All sources (upload, memory, code_context,
 * docs, web_capture) stored in a single table with source_type discriminator.
 */

import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import type { KnowledgeDocument, KnowledgeSourceType } from "../../schemas/knowledge.schema.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";
import { getPhaseBoost, applyPhaseBoost } from "../rag/phase-metadata.js";
import { PhaseBoostCache } from "../rag/phase-boost-cache.js";
import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

export interface InsertKnowledgeDoc {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  content: string;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
}

interface KnowledgeRow {
  id: string;
  source_type: string;
  source_id: string;
  title: string;
  content: string;
  content_hash: string;
  chunk_index: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDoc(row: KnowledgeRow): KnowledgeDocument {
  return {
    id: row.id,
    sourceType: row.source_type as KnowledgeSourceType,
    sourceId: row.source_id,
    title: row.title,
    content: row.content,
    contentHash: row.content_hash,
    chunkIndex: row.chunk_index,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Compute SHA-256 hash of content for deduplication.
 */
export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export class KnowledgeStore {
  private db: Database.Database;
  private phaseBoostCache = new PhaseBoostCache({ maxSize: 100, ttlMs: 2 * 60 * 1000 });

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Insert a knowledge document. Deduplicates by content_hash.
   * Returns the existing doc if content already exists, or the new doc.
   */
  private static readonly MAX_CONTENT_SIZE = 500_000; // ~125K tokens

  insert(doc: InsertKnowledgeDoc): KnowledgeDocument {
    // Bug #054: reject oversized content to prevent SQLite bloat
    if (doc.content.length > KnowledgeStore.MAX_CONTENT_SIZE) {
      throw new Error(`Content too large (${doc.content.length} chars, max ${KnowledgeStore.MAX_CONTENT_SIZE}). Chunk the content before indexing.`);
    }
    const hash = contentHash(doc.content);

    // Check for duplicate content
    const existing = this.db
      .prepare("SELECT * FROM knowledge_documents WHERE content_hash = ? AND source_id = ?")
      .get(hash, doc.sourceId) as KnowledgeRow | undefined;

    if (existing) {
      logger.debug("Knowledge doc dedup hit", { hash: hash.slice(0, 8), sourceId: doc.sourceId });
      return rowToDoc(existing);
    }

    const id = generateId("kdoc");
    const timestamp = now();

    this.db.prepare(
      `INSERT INTO knowledge_documents
        (id, source_type, source_id, title, content, content_hash, chunk_index, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      doc.sourceType,
      doc.sourceId,
      doc.title,
      doc.content,
      hash,
      doc.chunkIndex ?? 0,
      doc.metadata ? JSON.stringify(doc.metadata) : null,
      timestamp,
      timestamp,
    );

    logger.info("Knowledge doc inserted", { id, sourceType: doc.sourceType, title: doc.title });
    return this.getById(id) as KnowledgeDocument;
  }

  /**
   * Insert multiple chunks from a single source document.
   * Returns all inserted (or deduplicated) docs.
   */
  insertChunks(docs: InsertKnowledgeDoc[]): KnowledgeDocument[] {
    const results: KnowledgeDocument[] = [];

    this.db.transaction(() => {
      for (const doc of docs) {
        results.push(this.insert(doc));
      }
    })();

    return results;
  }

  /**
   * Get a knowledge document by ID.
   */
  getById(id: string): KnowledgeDocument | null {
    const row = this.db
      .prepare("SELECT * FROM knowledge_documents WHERE id = ?")
      .get(id) as KnowledgeRow | undefined;
    return row ? rowToDoc(row) : null;
  }

  /**
   * List knowledge documents, optionally filtered by source type.
   */
  list(options?: { sourceType?: KnowledgeSourceType; limit?: number; offset?: number }): KnowledgeDocument[] {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    if (options?.sourceType) {
      const rows = this.db
        .prepare(
          "SELECT * FROM knowledge_documents WHERE source_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .all(options.sourceType, limit, offset) as KnowledgeRow[];
      return rows.map(rowToDoc);
    }

    const rows = this.db
      .prepare(
        "SELECT * FROM knowledge_documents ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .all(limit, offset) as KnowledgeRow[];
    return rows.map(rowToDoc);
  }

  /**
   * Search knowledge documents via FTS5 with BM25 ranking.
   */
  search(query: string, limit: number = 20): Array<KnowledgeDocument & { score: number }> {
    const rows = this.db
      .prepare(
        `SELECT kd.*, bm25(knowledge_fts) AS score
         FROM knowledge_fts fts
         JOIN knowledge_documents kd ON kd.rowid = fts.rowid
         WHERE knowledge_fts MATCH ?
         ORDER BY score
         LIMIT ?`,
      )
      .all(query, limit) as Array<KnowledgeRow & { score: number }>;

    return rows.map((row) => ({
      ...rowToDoc(row),
      score: Math.abs(row.score),
    }));
  }

  /**
   * Search knowledge documents with phase-aware boosting.
   * Documents tagged with phases relevant to the current phase are ranked higher.
   */
  searchWithPhaseBoost(
    query: string,
    currentPhase: LifecyclePhase,
    limit: number = 20,
  ): Array<KnowledgeDocument & { score: number; phaseBoost: number }> {
    // Check cache first
    const cached = this.phaseBoostCache.get(query, currentPhase);
    if (cached) {
      return cached as Array<KnowledgeDocument & { score: number; phaseBoost: number }>;
    }

    // Fetch more results than needed to allow re-ranking (Bug #051: cap at 200)
    const rawResults = this.search(query, Math.min(limit * 2, 200));

    const boosted = rawResults.map((result) => {
      const docPhase = result.metadata?.phase as string | undefined;
      const boost = getPhaseBoost(currentPhase, docPhase);
      const boostedScore = applyPhaseBoost(result.score, boost);
      return {
        ...result,
        score: boostedScore,
        phaseBoost: boost,
      };
    });

    // Re-sort by boosted score (higher = better)
    boosted.sort((a, b) => b.score - a.score);

    const results = boosted.slice(0, limit);

    // Cache results
    this.phaseBoostCache.set(query, currentPhase, results);

    return results;
  }

  /**
   * Invalidate the phase-boosted search cache.
   * Call on knowledge:indexed events or phase changes.
   */
  invalidatePhaseBoostCache(): void {
    this.phaseBoostCache.invalidateAll();
  }

  /**
   * Delete a knowledge document by ID.
   */
  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM knowledge_documents WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  /**
   * Delete all documents from a specific source.
   */
  deleteBySource(sourceType: KnowledgeSourceType, sourceId: string): number {
    const result = this.db
      .prepare("DELETE FROM knowledge_documents WHERE source_type = ? AND source_id = ?")
      .run(sourceType, sourceId);
    logger.info("Knowledge docs deleted by source", { sourceType, sourceId, count: result.changes });
    return result.changes;
  }

  /**
   * Count documents, optionally filtered by source type.
   */
  count(sourceType?: KnowledgeSourceType): number {
    if (sourceType) {
      const row = this.db
        .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents WHERE source_type = ?")
        .get(sourceType) as { cnt: number };
      return row.cnt;
    }

    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents")
      .get() as { cnt: number };
    return row.cnt;
  }

  /**
   * Count documents grouped by source type in a single query.
   */
  countBySource(): { total: number; bySource: Record<string, number> } {
    const rows = this.db
      .prepare("SELECT source_type, COUNT(*) as cnt FROM knowledge_documents GROUP BY source_type")
      .all() as Array<{ source_type: string; cnt: number }>;

    const bySource: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      bySource[row.source_type] = row.cnt;
      total += row.cnt;
    }
    return { total, bySource };
  }

  /**
   * Check if content already exists (by hash).
   */
  existsByHash(hash: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM knowledge_documents WHERE content_hash = ? LIMIT 1")
      .get(hash);
    return row !== undefined;
  }

  /**
   * Get all documents for a given source ID (all chunks).
   */
  getBySourceId(sourceId: string): KnowledgeDocument[] {
    const rows = this.db
      .prepare("SELECT * FROM knowledge_documents WHERE source_id = ? ORDER BY chunk_index")
      .all(sourceId) as KnowledgeRow[];
    return rows.map(rowToDoc);
  }

  /**
   * Update the quality score for a document.
   */
  updateQualityScore(id: string, score: number): void {
    this.db
      .prepare("UPDATE knowledge_documents SET quality_score = ? WHERE id = ?")
      .run(score, id);
  }

  /**
   * Record access on a document — update last_accessed_at + increment usage_count.
   */
  recordAccess(id: string): void {
    const timestamp = now();
    this.db
      .prepare("UPDATE knowledge_documents SET last_accessed_at = ?, usage_count = usage_count + 1 WHERE id = ?")
      .run(timestamp, id);
  }

  /**
   * Batch update staleness_days for all documents.
   */
  batchUpdateStaleness(): number {
    // Bug #052: paginate to avoid loading ALL docs into memory
    const PAGE_SIZE = 1000;
    const update = this.db.prepare("UPDATE knowledge_documents SET staleness_days = ? WHERE id = ?");
    const select = this.db.prepare("SELECT id, created_at FROM knowledge_documents LIMIT ? OFFSET ?");
    let updated = 0;
    let offset = 0;

    while (true) {
      const rows = select.all(PAGE_SIZE, offset) as Array<{ id: string; created_at: string }>;
      if (rows.length === 0) break;

      this.db.transaction(() => {
        for (const row of rows) {
          const ageMs = Date.now() - new Date(row.created_at).getTime();
          const days = Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
          update.run(days, row.id);
          updated++;
        }
      })();

      offset += PAGE_SIZE;
      if (rows.length < PAGE_SIZE) break;
    }

    return updated;
  }

  /**
   * Batch update pre-computed recency_score for all documents.
   * Formula: pow(0.5, ageDays / 30) — 30-day half-life exponential decay.
   */
  batchUpdateRecencyScores(): number {
    const PAGE_SIZE = 1000;
    const update = this.db.prepare("UPDATE knowledge_documents SET recency_score = ? WHERE id = ?");
    const select = this.db.prepare("SELECT id, created_at FROM knowledge_documents LIMIT ? OFFSET ?");
    let updated = 0;
    let offset = 0;

    while (true) {
      const rows = select.all(PAGE_SIZE, offset) as Array<{ id: string; created_at: string }>;
      if (rows.length === 0) break;

      this.db.transaction(() => {
        for (const row of rows) {
          const ageMs = Date.now() - new Date(row.created_at).getTime();
          const ageDays = Math.max(0, ageMs / (24 * 60 * 60 * 1000));
          const score = Math.pow(0.5, ageDays / 30);
          update.run(score, row.id);
          updated++;
        }
      })();

      offset += PAGE_SIZE;
      if (rows.length < PAGE_SIZE) break;
    }

    logger.debug("Recency scores updated", { updated });
    return updated;
  }

  /**
   * Search with quality score weighting applied to BM25 results.
   */
  searchWithQuality(
    query: string,
    limit: number = 20,
    options?: { minQuality?: number },
  ): Array<KnowledgeDocument & { score: number; qualityScore: number }> {
    const minQuality = options?.minQuality ?? 0;
    const rows = this.db
      .prepare(
        `SELECT kd.*, bm25(knowledge_fts) AS bm25_score, COALESCE(kd.quality_score, 0.5) AS q_score
         FROM knowledge_fts fts
         JOIN knowledge_documents kd ON kd.rowid = fts.rowid
         WHERE knowledge_fts MATCH ?
           AND COALESCE(kd.quality_score, 0.5) >= ?
         ORDER BY (bm25(knowledge_fts) * COALESCE(kd.quality_score, 0.5))
         LIMIT ?`,
      )
      .all(query, minQuality, limit) as Array<KnowledgeRow & { bm25_score: number; q_score: number }>;

    return rows.map((row) => ({
      ...rowToDoc(row),
      score: Math.abs(row.bm25_score) * row.q_score,
      qualityScore: row.q_score,
    }));
  }

  /**
   * Get related documents via knowledge_relations table.
   */
  getRelated(docId: string, limit: number = 10): KnowledgeDocument[] {
    const rows = this.db
      .prepare(
        `SELECT kd.* FROM knowledge_relations kr
         JOIN knowledge_documents kd ON kd.id = kr.to_doc_id
         WHERE kr.from_doc_id = ?
         UNION
         SELECT kd.* FROM knowledge_relations kr
         JOIN knowledge_documents kd ON kd.id = kr.from_doc_id
         WHERE kr.to_doc_id = ?
         LIMIT ?`,
      )
      .all(docId, docId, limit) as KnowledgeRow[];
    return rows.map(rowToDoc);
  }
}
