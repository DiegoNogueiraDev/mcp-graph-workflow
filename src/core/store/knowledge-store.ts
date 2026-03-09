/**
 * Knowledge Store — CRUD, FTS search, and dedup for knowledge_documents.
 * Follows DocsCacheStore pattern. All sources (upload, serena, code_context,
 * docs, web_capture) stored in a single table with source_type discriminator.
 */

import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import type { KnowledgeDocument, KnowledgeSourceType } from "../../schemas/knowledge.schema.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

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

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Insert a knowledge document. Deduplicates by content_hash.
   * Returns the existing doc if content already exists, or the new doc.
   */
  insert(doc: InsertKnowledgeDoc): KnowledgeDocument {
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
    return this.getById(id)!;
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
      score: row.score,
    }));
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
}
