/**
 * SQLite CRUD operations for code_symbols and code_relations tables.
 * Uses the same Database instance from SqliteStore (shared DB).
 */

import type Database from "better-sqlite3";
import type { CodeSymbol, CodeRelation, CodeIndexMeta } from "./code-types.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";

// ── Row types (SQLite ↔ JS) ─────────────────────────────

interface SymbolRow {
  id: string;
  project_id: string;
  name: string;
  kind: string;
  file: string;
  start_line: number;
  end_line: number;
  exported: number;
  module_path: string | null;
  signature: string | null;
  metadata: string | null;
  language: string | null;
  docstring: string | null;
  source_snippet: string | null;
  visibility: string | null;
  indexed_at: string;
}

interface RelationRow {
  id: string;
  project_id: string;
  from_symbol: string;
  to_symbol: string;
  type: string;
  file: string | null;
  line: number | null;
  metadata: string | null;
  indexed_at: string;
}

interface MetaRow {
  project_id: string;
  last_indexed: string;
  file_count: number;
  symbol_count: number;
  relation_count: number;
  git_hash: string | null;
}

// ── Mappers ──────────────────────────────────────────────

function rowToSymbol(row: SymbolRow): CodeSymbol {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    kind: row.kind as CodeSymbol["kind"],
    file: row.file,
    startLine: row.start_line,
    endLine: row.end_line,
    exported: row.exported === 1,
    modulePath: row.module_path,
    signature: row.signature,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    language: row.language ?? "typescript",
    docstring: row.docstring ?? undefined,
    sourceSnippet: row.source_snippet ?? undefined,
    visibility: row.visibility ?? "public",
    indexedAt: row.indexed_at,
  };
}

function rowToRelation(row: RelationRow): CodeRelation {
  return {
    id: row.id,
    projectId: row.project_id,
    fromSymbol: row.from_symbol,
    toSymbol: row.to_symbol,
    type: row.type as CodeRelation["type"],
    file: row.file,
    line: row.line,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    indexedAt: row.indexed_at,
  };
}

function rowToMeta(row: MetaRow): CodeIndexMeta {
  return {
    projectId: row.project_id,
    lastIndexed: row.last_indexed,
    fileCount: row.file_count,
    symbolCount: row.symbol_count,
    relationCount: row.relation_count,
    gitHash: row.git_hash,
  };
}

// ── CodeStore ────────────────────────────────────────────

export class CodeStore {
  constructor(private readonly db: Database.Database) {}

  // ── Symbols ──────────────────────────────────────

  insertSymbol(symbol: Omit<CodeSymbol, "id" | "indexedAt">): CodeSymbol {
    const id = generateId("csym");
    const indexedAt = now();
    this.db
      .prepare(
        `INSERT INTO code_symbols (id, project_id, name, kind, file, start_line, end_line, exported, module_path, signature, metadata, language, docstring, source_snippet, visibility, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        symbol.projectId,
        symbol.name,
        symbol.kind,
        symbol.file,
        symbol.startLine,
        symbol.endLine,
        symbol.exported ? 1 : 0,
        symbol.modulePath ?? null,
        symbol.signature ?? null,
        symbol.metadata ? JSON.stringify(symbol.metadata) : null,
        symbol.language ?? "typescript",
        symbol.docstring ?? null,
        symbol.sourceSnippet ?? null,
        symbol.visibility ?? "public",
        indexedAt,
      );
    return { ...symbol, id, indexedAt };
  }

  insertSymbolsBulk(symbols: Omit<CodeSymbol, "id" | "indexedAt">[]): number {
    const indexedAt = now();
    const stmt = this.db.prepare(
      `INSERT INTO code_symbols (id, project_id, name, kind, file, start_line, end_line, exported, module_path, signature, metadata, language, docstring, source_snippet, visibility, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertMany = this.db.transaction((syms: typeof symbols) => {
      for (const s of syms) {
        stmt.run(
          generateId("csym"),
          s.projectId,
          s.name,
          s.kind,
          s.file,
          s.startLine,
          s.endLine,
          s.exported ? 1 : 0,
          s.modulePath ?? null,
          s.signature ?? null,
          s.metadata ? JSON.stringify(s.metadata) : null,
          s.language ?? "typescript",
          s.docstring ?? null,
          s.sourceSnippet ?? null,
          s.visibility ?? "public",
          indexedAt,
        );
      }
      return syms.length;
    });

    return insertMany(symbols);
  }

  getSymbol(id: string): CodeSymbol | null {
    const row = this.db
      .prepare("SELECT * FROM code_symbols WHERE id = ?")
      .get(id) as SymbolRow | undefined;
    return row ? rowToSymbol(row) : null;
  }

  findSymbolsByName(name: string, projectId: string): CodeSymbol[] {
    const rows = this.db
      .prepare("SELECT * FROM code_symbols WHERE name = ? AND project_id = ?")
      .all(name, projectId) as SymbolRow[];
    return rows.map(rowToSymbol);
  }

  findSymbolsByFile(file: string, projectId: string): CodeSymbol[] {
    const rows = this.db
      .prepare("SELECT * FROM code_symbols WHERE file = ? AND project_id = ?")
      .all(file, projectId) as SymbolRow[];
    return rows.map(rowToSymbol);
  }

  findSymbolsByLanguage(language: string, projectId: string): CodeSymbol[] {
    const rows = this.db
      .prepare("SELECT * FROM code_symbols WHERE language = ? AND project_id = ?")
      .all(language, projectId) as SymbolRow[];
    return rows.map(rowToSymbol);
  }

  findSymbolAtLine(file: string, line: number, projectId: string): CodeSymbol | null {
    const row = this.db
      .prepare(
        "SELECT * FROM code_symbols WHERE file = ? AND start_line <= ? AND end_line >= ? AND project_id = ? ORDER BY (end_line - start_line) ASC LIMIT 1",
      )
      .get(file, line, line, projectId) as SymbolRow | undefined;
    return row ? rowToSymbol(row) : null;
  }

  getAllSymbols(projectId: string, limit: number = 5000, offset: number = 0): CodeSymbol[] {
    const rows = this.db
      .prepare("SELECT * FROM code_symbols WHERE project_id = ? LIMIT ? OFFSET ?")
      .all(projectId, limit, offset) as SymbolRow[];
    return rows.map(rowToSymbol);
  }

  countSymbols(projectId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM code_symbols WHERE project_id = ?")
      .get(projectId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  countRelations(projectId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM code_relations WHERE project_id = ?")
      .get(projectId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  deleteSymbolsByFile(file: string, projectId: string): number {
    // First delete relations referencing these symbols
    const symbolIds = this.db
      .prepare("SELECT id FROM code_symbols WHERE file = ? AND project_id = ?")
      .all(file, projectId) as Array<{ id: string }>;

    if (symbolIds.length === 0) return 0;

    const ids = symbolIds.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");

    this.db
      .prepare(`DELETE FROM code_relations WHERE from_symbol IN (${placeholders}) OR to_symbol IN (${placeholders})`)
      .run(...ids, ...ids);

    const result = this.db
      .prepare("DELETE FROM code_symbols WHERE file = ? AND project_id = ?")
      .run(file, projectId);

    return result.changes;
  }

  deleteAllSymbols(projectId: string): void {
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM code_relations WHERE project_id = ?").run(projectId);
      this.db.prepare("DELETE FROM code_symbols WHERE project_id = ?").run(projectId);
    })();
  }

  // ── Relations ────────────────────────────────────

  insertRelation(relation: Omit<CodeRelation, "id" | "indexedAt">): CodeRelation {
    const id = generateId("crel");
    const indexedAt = now();
    this.db
      .prepare(
        `INSERT INTO code_relations (id, project_id, from_symbol, to_symbol, type, file, line, metadata, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        relation.projectId,
        relation.fromSymbol,
        relation.toSymbol,
        relation.type,
        relation.file ?? null,
        relation.line ?? null,
        relation.metadata ? JSON.stringify(relation.metadata) : null,
        indexedAt,
      );
    return { ...relation, id, indexedAt };
  }

  insertRelationsBulk(relations: Omit<CodeRelation, "id" | "indexedAt">[]): number {
    const indexedAt = now();
    const stmt = this.db.prepare(
      `INSERT INTO code_relations (id, project_id, from_symbol, to_symbol, type, file, line, metadata, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertMany = this.db.transaction((rels: typeof relations) => {
      for (const r of rels) {
        stmt.run(
          generateId("crel"),
          r.projectId,
          r.fromSymbol,
          r.toSymbol,
          r.type,
          r.file ?? null,
          r.line ?? null,
          r.metadata ? JSON.stringify(r.metadata) : null,
          indexedAt,
        );
      }
      return rels.length;
    });

    return insertMany(relations);
  }

  getRelationsFrom(symbolId: string): CodeRelation[] {
    const rows = this.db
      .prepare("SELECT * FROM code_relations WHERE from_symbol = ?")
      .all(symbolId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  getRelationsTo(symbolId: string): CodeRelation[] {
    const rows = this.db
      .prepare("SELECT * FROM code_relations WHERE to_symbol = ?")
      .all(symbolId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  getRelationsBetween(fromId: string, toId: string): CodeRelation[] {
    const rows = this.db
      .prepare("SELECT * FROM code_relations WHERE from_symbol = ? AND to_symbol = ?")
      .all(fromId, toId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  getAllRelations(projectId: string, limit: number = 10000): CodeRelation[] {
    const rows = this.db
      .prepare("SELECT * FROM code_relations WHERE project_id = ? LIMIT ?")
      .all(projectId, limit) as RelationRow[];
    return rows.map(rowToRelation);
  }

  // ── FTS5 Search ──────────────────────────────────

  searchSymbols(query: string, projectId: string, limit: number = 20): Array<{ symbol: CodeSymbol; score: number }> {
    const rows = this.db
      .prepare(
        `SELECT cs.*, rank AS score
         FROM code_symbols_fts fts
         JOIN code_symbols cs ON cs.rowid = fts.rowid
         WHERE code_symbols_fts MATCH ? AND cs.project_id = ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(query, projectId, limit) as Array<SymbolRow & { score: number }>;

    return rows.map((row) => ({
      symbol: rowToSymbol(row),
      score: Math.abs(row.score), // BM25 returns negative scores
    }));
  }

  // ── Index Meta ───────────────────────────────────

  getIndexMeta(projectId: string): CodeIndexMeta | null {
    const row = this.db
      .prepare("SELECT * FROM code_index_meta WHERE project_id = ?")
      .get(projectId) as MetaRow | undefined;
    return row ? rowToMeta(row) : null;
  }

  upsertIndexMeta(meta: CodeIndexMeta): void {
    this.db
      .prepare(
        `INSERT INTO code_index_meta (project_id, last_indexed, file_count, symbol_count, relation_count, git_hash)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           last_indexed = excluded.last_indexed,
           file_count = excluded.file_count,
           symbol_count = excluded.symbol_count,
           relation_count = excluded.relation_count,
           git_hash = excluded.git_hash`,
      )
      .run(
        meta.projectId,
        meta.lastIndexed,
        meta.fileCount,
        meta.symbolCount,
        meta.relationCount,
        meta.gitHash ?? null,
      );
  }

  // ── Stats ────────────────────────────────────────

  getSymbolCount(projectId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM code_symbols WHERE project_id = ?")
      .get(projectId) as { count: number };
    return row.count;
  }

  getRelationCount(projectId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM code_relations WHERE project_id = ?")
      .get(projectId) as { count: number };
    return row.count;
  }

  getModulePaths(projectId: string): string[] {
    const rows = this.db
      .prepare("SELECT DISTINCT module_path FROM code_symbols WHERE project_id = ? AND module_path IS NOT NULL ORDER BY module_path")
      .all(projectId) as Array<{ module_path: string }>;
    return rows.map((r) => r.module_path);
  }
}
