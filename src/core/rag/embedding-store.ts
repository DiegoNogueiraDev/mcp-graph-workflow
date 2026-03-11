/**
 * Embedding store — persists vector embeddings in SQLite.
 * Supports cosine similarity search for semantic retrieval.
 * All data stays local — no external API calls.
 */

import type Database from "better-sqlite3";
import type { SqliteStore } from "../store/sqlite-store.js";

export interface EmbeddingEntry {
  id: string;
  source: string;        // e.g. "node", "doc", "prd"
  sourceId: string;      // e.g. node ID
  text: string;          // original text that was embedded
  embedding: number[];   // vector
}

export interface SimilarityResult {
  id: string;
  source: string;
  sourceId: string;
  text: string;
  similarity: number;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    text TEXT NOT NULL,
    embedding BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Serialize a number array to a Buffer for SQLite BLOB storage.
 */
function serializeVector(vec: number[]): Buffer {
  const buf = Buffer.alloc(vec.length * 8);
  for (let i = 0; i < vec.length; i++) {
    buf.writeDoubleLE(vec[i], i * 8);
  }
  return buf;
}

/**
 * Deserialize a Buffer from SQLite BLOB to a number array.
 */
function deserializeVector(buf: Buffer): number[] {
  const vec: number[] = [];
  for (let i = 0; i < buf.length; i += 8) {
    vec.push(buf.readDoubleLE(i));
  }
  return vec;
}

interface EmbeddingRow {
  id: string;
  source: string;
  source_id: string;
  text: string;
  embedding: Buffer;
}

export class EmbeddingStore {
  private db: Database.Database;

  constructor(private sqliteStore: SqliteStore) {
    this.db = this.sqliteStore.getDb();
    this.db.exec(CREATE_TABLE_SQL);
  }

  /**
   * Insert or update an embedding entry.
   */
  upsert(entry: EmbeddingEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO embeddings (id, source, source_id, text, embedding)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source,
        source_id = excluded.source_id,
        text = excluded.text,
        embedding = excluded.embedding
    `);
    stmt.run(
      entry.id,
      entry.source,
      entry.sourceId,
      entry.text,
      serializeVector(entry.embedding),
    );
  }

  /**
   * Get an embedding entry by ID.
   */
  getById(id: string): EmbeddingEntry | null {
    const stmt = this.db.prepare(
      "SELECT id, source, source_id, text, embedding FROM embeddings WHERE id = ?",
    );
    const row = stmt.get(id) as EmbeddingRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      text: row.text,
      embedding: deserializeVector(row.embedding),
    };
  }

  /**
   * Find the most similar embeddings to a query vector using cosine similarity.
   * Performs brute-force search (suitable for < 100k embeddings).
   */
  findSimilar(queryVector: number[], limit: number = 10): SimilarityResult[] {
    const stmt = this.db.prepare(
      "SELECT id, source, source_id, text, embedding FROM embeddings",
    );
    const rows = stmt.all() as EmbeddingRow[];

    const results: SimilarityResult[] = rows.map((row) => ({
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      text: row.text,
      similarity: cosineSimilarity(queryVector, deserializeVector(row.embedding)),
    }));

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  /**
   * Count stored embeddings.
   */
  count(): number {
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM embeddings",
    );
    const row = stmt.get() as { cnt: number };
    return row.cnt;
  }

  /**
   * Delete an embedding by ID.
   */
  delete(id: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM embeddings WHERE id = ?",
    );
    stmt.run(id);
  }

  /**
   * Clear all embeddings.
   */
  clear(): void {
    this.db.exec("DELETE FROM embeddings");
  }
}
