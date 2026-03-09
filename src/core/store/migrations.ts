import type Database from "better-sqlite3";

interface Migration {
  version: number;
  description: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "Initial schema — projects, nodes, edges, snapshots, import_history",
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nodes (
        id                  TEXT PRIMARY KEY,
        project_id          TEXT NOT NULL REFERENCES projects(id),
        type                TEXT NOT NULL,
        title               TEXT NOT NULL,
        description         TEXT,
        status              TEXT NOT NULL DEFAULT 'backlog',
        priority            INTEGER NOT NULL DEFAULT 3,
        xp_size             TEXT,
        estimate_minutes    INTEGER,
        tags                TEXT, -- JSON array
        parent_id           TEXT,
        sprint              TEXT,
        source_file         TEXT,
        source_start_line   INTEGER,
        source_end_line     INTEGER,
        source_confidence   REAL,
        acceptance_criteria TEXT, -- JSON array
        blocked             INTEGER NOT NULL DEFAULT 0,
        metadata            TEXT, -- JSON object
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS edges (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL REFERENCES projects(id),
        from_node     TEXT NOT NULL REFERENCES nodes(id),
        to_node       TEXT NOT NULL REFERENCES nodes(id),
        relation_type TEXT NOT NULL,
        weight        REAL,
        reason        TEXT,
        metadata      TEXT, -- JSON object
        created_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        data        TEXT NOT NULL, -- JSON dump of GraphDocument
        created_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_history (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id     TEXT NOT NULL REFERENCES projects(id),
        source_file    TEXT NOT NULL,
        nodes_created  INTEGER NOT NULL DEFAULT 0,
        edges_created  INTEGER NOT NULL DEFAULT 0,
        imported_at    TEXT NOT NULL
      );

      -- Indexes for common query patterns
      CREATE INDEX IF NOT EXISTS idx_nodes_project     ON nodes(project_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_type        ON nodes(project_id, type);
      CREATE INDEX IF NOT EXISTS idx_nodes_status      ON nodes(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_nodes_parent      ON nodes(parent_id);
      CREATE INDEX IF NOT EXISTS idx_edges_project     ON edges(project_id);
      CREATE INDEX IF NOT EXISTS idx_edges_from        ON edges(from_node);
      CREATE INDEX IF NOT EXISTS idx_edges_to          ON edges(to_node);
      CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
      CREATE INDEX IF NOT EXISTS idx_imports_project   ON import_history(project_id);
    `,
  },
  {
    version: 2,
    description: "FTS5 full-text search index on nodes",
    sql: `
      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
        title, description, tags,
        content='nodes', content_rowid='rowid'
      );

      -- Populate FTS from existing nodes
      INSERT INTO nodes_fts(rowid, title, description, tags)
        SELECT rowid, title, COALESCE(description, ''), COALESCE(tags, '')
        FROM nodes;

      -- Sync triggers: keep FTS in sync with nodes table
      CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, title, description, tags)
          VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''), COALESCE(NEW.tags, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, title, description, tags)
          VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''), COALESCE(OLD.tags, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, title, description, tags)
          VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''), COALESCE(OLD.tags, ''));
        INSERT INTO nodes_fts(rowid, title, description, tags)
          VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''), COALESCE(NEW.tags, ''));
      END;
    `,
  },
  {
    version: 3,
    description: "Docs cache table with FTS5 index for Context7 documentation",
    sql: `
      CREATE TABLE IF NOT EXISTS docs_cache (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        lib_id       TEXT NOT NULL,
        lib_name     TEXT NOT NULL,
        version      TEXT,
        content      TEXT NOT NULL,
        fetched_at   TEXT NOT NULL,
        UNIQUE(lib_id)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
        lib_name, content,
        content='docs_cache', content_rowid='id'
      );

      -- Sync triggers: keep FTS in sync with docs_cache table
      CREATE TRIGGER IF NOT EXISTS docs_fts_insert AFTER INSERT ON docs_cache BEGIN
        INSERT INTO docs_fts(rowid, lib_name, content)
          VALUES (NEW.id, NEW.lib_name, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS docs_fts_delete AFTER DELETE ON docs_cache BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, lib_name, content)
          VALUES ('delete', OLD.id, OLD.lib_name, OLD.content);
      END;

      CREATE TRIGGER IF NOT EXISTS docs_fts_update AFTER UPDATE ON docs_cache BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, lib_name, content)
          VALUES ('delete', OLD.id, OLD.lib_name, OLD.content);
        INSERT INTO docs_fts(rowid, lib_name, content)
          VALUES (NEW.id, NEW.lib_name, NEW.content);
      END;
    `,
  },
  {
    version: 4,
    description: "Knowledge documents table with FTS5 index for unified knowledge store",
    sql: `
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id            TEXT PRIMARY KEY,
        source_type   TEXT NOT NULL,
        source_id     TEXT NOT NULL,
        title         TEXT NOT NULL,
        content       TEXT NOT NULL,
        content_hash  TEXT NOT NULL,
        chunk_index   INTEGER NOT NULL DEFAULT 0,
        metadata      TEXT, -- JSON object
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON knowledge_documents(source_type);
      CREATE INDEX IF NOT EXISTS idx_knowledge_source_id ON knowledge_documents(source_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_content_hash ON knowledge_documents(content_hash);

      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        title, content,
        content='knowledge_documents', content_rowid='rowid'
      );

      -- Sync triggers: keep FTS in sync with knowledge_documents table
      CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge_documents BEGIN
        INSERT INTO knowledge_fts(rowid, title, content)
          VALUES (NEW.rowid, NEW.title, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete AFTER DELETE ON knowledge_documents BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
      END;

      CREATE TRIGGER IF NOT EXISTS knowledge_fts_update AFTER UPDATE ON knowledge_documents BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
        INSERT INTO knowledge_fts(rowid, title, content)
          VALUES (NEW.rowid, NEW.title, NEW.content);
      END;
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version     INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at  TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM _migrations")
      .all()
      .map((row) => (row as { version: number }).version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.description, new Date().toISOString());
    })();
  }
}

export function configureDb(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
}
