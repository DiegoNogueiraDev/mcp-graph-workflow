import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

export interface CachedDoc {
  id: number;
  libId: string;
  libName: string;
  version: string | null;
  content: string;
  fetchedAt: string;
}

interface DocRow {
  id: number;
  lib_id: string;
  lib_name: string;
  version: string | null;
  content: string;
  fetched_at: string;
}

function rowToDoc(row: DocRow): CachedDoc {
  return {
    id: row.id,
    libId: row.lib_id,
    libName: row.lib_name,
    version: row.version,
    content: row.content,
    fetchedAt: row.fetched_at,
  };
}

export class DocsCacheStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  upsertDoc(doc: {
    libId: string;
    libName: string;
    version?: string;
    content: string;
  }): CachedDoc {
    const fetchedAt = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO docs_cache (lib_id, lib_name, version, content, fetched_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(lib_id) DO UPDATE SET
           lib_name = excluded.lib_name,
           version = excluded.version,
           content = excluded.content,
           fetched_at = excluded.fetched_at`,
      )
      .run(doc.libId, doc.libName, doc.version ?? null, doc.content, fetchedAt);

    logger.info(`Docs cache upserted: ${doc.libName} (${doc.libId})`);
    const result = this.getDoc(doc.libId);
    if (!result) {
      throw new Error(`Failed to retrieve doc after upsert: ${doc.libId}`);
    }
    return result;
  }

  getDoc(libId: string): CachedDoc | null {
    const row = this.db
      .prepare("SELECT * FROM docs_cache WHERE lib_id = ?")
      .get(libId) as DocRow | undefined;
    return row ? rowToDoc(row) : null;
  }

  searchDocs(query: string, limit: number = 20): CachedDoc[] {
    const rows = this.db
      .prepare(
        `SELECT d.*
         FROM docs_fts fts
         JOIN docs_cache d ON d.id = fts.rowid
         WHERE docs_fts MATCH ?
         LIMIT ?`,
      )
      .all(query, limit) as DocRow[];
    return rows.map(rowToDoc);
  }

  listCached(): CachedDoc[] {
    const rows = this.db
      .prepare("SELECT * FROM docs_cache ORDER BY fetched_at DESC")
      .all() as DocRow[];
    return rows.map(rowToDoc);
  }

  getStaleLibs(maxAgeMs: number): CachedDoc[] {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const rows = this.db
      .prepare("SELECT * FROM docs_cache WHERE fetched_at < ? ORDER BY fetched_at ASC")
      .all(cutoff) as DocRow[];
    return rows.map(rowToDoc);
  }
}
