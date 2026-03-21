import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

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
  {
    version: 5,
    description: "Project settings key-value store for lifecycle overrides",
    sql: `
      CREATE TABLE IF NOT EXISTS project_settings (
        project_id  TEXT NOT NULL REFERENCES projects(id),
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (project_id, key)
      );
    `,
  },
  {
    version: 6,
    description: "Code Intelligence — symbols, relations, FTS5 index, index metadata",
    sql: `
      CREATE TABLE IF NOT EXISTS code_symbols (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        name        TEXT NOT NULL,
        kind        TEXT NOT NULL,
        file        TEXT NOT NULL,
        start_line  INTEGER NOT NULL,
        end_line    INTEGER NOT NULL,
        exported    INTEGER NOT NULL DEFAULT 0,
        module_path TEXT,
        signature   TEXT,
        metadata    TEXT,
        indexed_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS code_relations (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        from_symbol TEXT NOT NULL REFERENCES code_symbols(id),
        to_symbol   TEXT NOT NULL REFERENCES code_symbols(id),
        type        TEXT NOT NULL,
        file        TEXT,
        line        INTEGER,
        metadata    TEXT,
        indexed_at  TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS code_symbols_fts USING fts5(
        name, file, signature,
        content='code_symbols', content_rowid='rowid'
      );

      -- FTS5 sync triggers
      CREATE TRIGGER IF NOT EXISTS code_fts_insert AFTER INSERT ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(rowid, name, file, signature)
          VALUES (NEW.rowid, NEW.name, NEW.file, COALESCE(NEW.signature, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS code_fts_delete AFTER DELETE ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(code_symbols_fts, rowid, name, file, signature)
          VALUES ('delete', OLD.rowid, OLD.name, OLD.file, COALESCE(OLD.signature, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS code_fts_update AFTER UPDATE ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(code_symbols_fts, rowid, name, file, signature)
          VALUES ('delete', OLD.rowid, OLD.name, OLD.file, COALESCE(OLD.signature, ''));
        INSERT INTO code_symbols_fts(rowid, name, file, signature)
          VALUES (NEW.rowid, NEW.name, NEW.file, COALESCE(NEW.signature, ''));
      END;

      CREATE TABLE IF NOT EXISTS code_index_meta (
        project_id    TEXT PRIMARY KEY,
        last_indexed  TEXT NOT NULL,
        file_count    INTEGER DEFAULT 0,
        symbol_count  INTEGER DEFAULT 0,
        relation_count INTEGER DEFAULT 0,
        git_hash      TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_code_sym_project ON code_symbols(project_id);
      CREATE INDEX IF NOT EXISTS idx_code_sym_name ON code_symbols(name);
      CREATE INDEX IF NOT EXISTS idx_code_sym_file ON code_symbols(file);
      CREATE INDEX IF NOT EXISTS idx_code_rel_from ON code_relations(from_symbol);
      CREATE INDEX IF NOT EXISTS idx_code_rel_to ON code_relations(to_symbol);
      CREATE INDEX IF NOT EXISTS idx_code_rel_type ON code_relations(type);
    `,
  },
  {
    version: 7,
    description: "Tool token usage tracking for benchmark analytics",
    sql: `
      CREATE TABLE IF NOT EXISTS tool_token_usage (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id    TEXT NOT NULL REFERENCES projects(id),
        tool_name     TEXT NOT NULL,
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        called_at     TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ttu_project ON tool_token_usage(project_id);
      CREATE INDEX IF NOT EXISTS idx_ttu_tool    ON tool_token_usage(tool_name);
      CREATE INDEX IF NOT EXISTS idx_ttu_called  ON tool_token_usage(called_at);
    `,
  },
  {
    version: 8,
    description: "Global mode — fs_path on projects, project_id on knowledge_documents",
    sql: `
      ALTER TABLE projects ADD COLUMN fs_path TEXT;
      CREATE INDEX IF NOT EXISTS idx_projects_fs_path ON projects(fs_path);

      ALTER TABLE knowledge_documents ADD COLUMN project_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_documents(project_id);
    `,
  },
  {
    version: 9,
    description: "Skill preferences and custom skills tables",
    sql: `
      CREATE TABLE IF NOT EXISTS skill_preferences (
        project_id  TEXT NOT NULL,
        skill_name  TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 1,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (project_id, skill_name)
      );

      CREATE TABLE IF NOT EXISTS custom_skills (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        name        TEXT NOT NULL,
        description TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'know-me',
        phases      TEXT NOT NULL,
        instructions TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE(project_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_custom_skills_project ON custom_skills(project_id);
    `,
  },
  {
    version: 10,
    description: "Edge deduplication — remove duplicates, add UNIQUE constraint",
    sql: `
      DELETE FROM edges WHERE rowid NOT IN (
        SELECT MIN(rowid) FROM edges GROUP BY project_id, from_node, to_node, relation_type
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique
        ON edges(project_id, from_node, to_node, relation_type);
    `,
  },
  {
    version: 11,
    description: "Journey maps — screens, edges, and variants for website journey mapping",
    sql: `
      CREATE TABLE IF NOT EXISTS journey_maps (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        name        TEXT NOT NULL,
        url         TEXT,
        description TEXT,
        metadata    TEXT, -- JSON object
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journey_screens (
        id          TEXT PRIMARY KEY,
        map_id      TEXT NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        title       TEXT NOT NULL,
        description TEXT,
        screenshot  TEXT, -- filename relative to journey-screenshots/
        url         TEXT,
        screen_type TEXT NOT NULL DEFAULT 'page',
        fields      TEXT, -- JSON array
        ctas        TEXT, -- JSON array
        metadata    TEXT, -- JSON object
        position_x  REAL DEFAULT 0,
        position_y  REAL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journey_edges (
        id          TEXT PRIMARY KEY,
        map_id      TEXT NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        from_screen TEXT NOT NULL REFERENCES journey_screens(id) ON DELETE CASCADE,
        to_screen   TEXT NOT NULL REFERENCES journey_screens(id) ON DELETE CASCADE,
        label       TEXT,
        edge_type   TEXT NOT NULL DEFAULT 'navigation',
        metadata    TEXT, -- JSON object
        created_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journey_variants (
        id          TEXT PRIMARY KEY,
        map_id      TEXT NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        name        TEXT NOT NULL,
        description TEXT,
        path        TEXT NOT NULL, -- JSON array of screen IDs
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_journey_maps_project ON journey_maps(project_id);
      CREATE INDEX IF NOT EXISTS idx_journey_screens_map ON journey_screens(map_id);
      CREATE INDEX IF NOT EXISTS idx_journey_edges_map ON journey_edges(map_id);
      CREATE INDEX IF NOT EXISTS idx_journey_edges_from ON journey_edges(from_screen);
      CREATE INDEX IF NOT EXISTS idx_journey_edges_to ON journey_edges(to_screen);
      CREATE INDEX IF NOT EXISTS idx_journey_variants_map ON journey_variants(map_id);
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

    logger.info("migration:run", { version: migration.version, description: migration.description });
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.description, new Date().toISOString());
    })();
    logger.info("migration:ok", { version: migration.version });
  }
}

export function configureDb(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
}
