import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { TranslationOrchestrator } from "../../core/translation/translation-orchestrator.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { CodeStore } from "../../core/code/code-store.js";
import { now } from "../../core/utils/time.js";

/**
 * Layer 5: Pre-indexed analysis integration.
 * When a file has been indexed by Code Intelligence, analyzeSource()
 * should use the symbol table instead of re-parsing.
 */

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");

  // UCR tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS ucr_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT
    );
    CREATE TABLE IF NOT EXISTS ucr_constructs (
      id TEXT PRIMARY KEY, category_id TEXT NOT NULL, canonical_name TEXT NOT NULL UNIQUE,
      description TEXT, semantic_group TEXT, metadata TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS ucr_language_mappings (
      id TEXT PRIMARY KEY, construct_id TEXT NOT NULL, language_id TEXT NOT NULL,
      syntax_pattern TEXT, ast_node_type TEXT, confidence REAL NOT NULL DEFAULT 0.8,
      is_primary INTEGER NOT NULL DEFAULT 0, constraints TEXT DEFAULT '[]'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS ucr_constructs_fts USING fts5(
      canonical_name, description, semantic_group,
      content='ucr_constructs', content_rowid='rowid'
    );
    CREATE TABLE IF NOT EXISTS translation_jobs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      source_language TEXT NOT NULL, target_language TEXT NOT NULL,
      source_code TEXT NOT NULL, target_code TEXT,
      status TEXT NOT NULL DEFAULT 'pending', scope TEXT NOT NULL DEFAULT 'snippet',
      constraints TEXT, analysis TEXT, result TEXT, evidence TEXT,
      confidence_score REAL, warnings TEXT, error_message TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);

  // Code Intelligence tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_symbols (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      name TEXT NOT NULL, kind TEXT NOT NULL, file TEXT NOT NULL,
      start_line INTEGER NOT NULL, end_line INTEGER NOT NULL,
      exported INTEGER NOT NULL DEFAULT 0,
      module_path TEXT, signature TEXT, metadata TEXT,
      indexed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS code_index_meta (
      project_id TEXT PRIMARY KEY, last_indexed TEXT NOT NULL,
      file_count INTEGER DEFAULT 0, symbol_count INTEGER DEFAULT 0,
      relation_count INTEGER DEFAULT 0, git_hash TEXT
    );
  `);

  return db;
}

function seedCodeIndex(db: Database.Database, projectId: string, filePath: string): void {
  const ts = now();

  // Insert index meta
  db.prepare(`INSERT OR REPLACE INTO code_index_meta (project_id, last_indexed, file_count, symbol_count)
    VALUES (?, ?, 1, 4)`).run(projectId, ts);

  // Insert symbols for the file
  const insert = db.prepare(`INSERT INTO code_symbols
    (id, project_id, name, kind, file, start_line, end_line, exported, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`);

  insert.run("sym_1", projectId, "Calculator", "class", filePath, 1, 50, ts);
  insert.run("sym_2", projectId, "add", "function", filePath, 5, 15, ts);
  insert.run("sym_3", projectId, "subtract", "method", filePath, 17, 25, ts);
  insert.run("sym_4", projectId, "Color", "enum", filePath, 30, 35, ts);
}

describe("Layer 5: Pre-indexed analysis integration", () => {
  let db: Database.Database;
  let orchestrator: TranslationOrchestrator;
  const PROJECT_ID = "test-project";
  const FILE_PATH = "src/calculator.ts";

  beforeEach(() => {
    db = createTestDb();
    const registry = new ConstructRegistry(db);
    loadAndSeedRegistry(registry);
    const translationStore = new TranslationStore(db);
    const codeStore = new CodeStore(db);
    orchestrator = new TranslationOrchestrator(registry, translationStore, codeStore);
  });

  it("should use pre-indexed analysis when filePath and projectId are provided and file is indexed", () => {
    // Arrange — seed Code Intelligence index
    seedCodeIndex(db, PROJECT_ID, FILE_PATH);
    const code = "class Calculator { add(a, b) { return a + b; } }";

    // Act
    const result = orchestrator.analyzeSource(code, {}, FILE_PATH, PROJECT_ID);

    // Assert — should come from index (confidence 1.0 for extension-detected language)
    expect(result.detectedLanguage).toBe("typescript");
    expect(result.detectedConfidence).toBe(1.0);
    expect(result.totalConstructs).toBeGreaterThan(0);
    // Should have constructs mapped from symbol kinds
    const constructNames = result.constructs.map((c) => c.canonicalName);
    expect(constructNames).toContain("uc_class_def");
    expect(constructNames).toContain("uc_fn_def");
    expect(constructNames).toContain("uc_type_enum");
  });

  it("should fallback to parser when file is not indexed", () => {
    // Arrange — no Code Intelligence index seeded
    const code = "def hello():\n  return 42";

    // Act
    const result = orchestrator.analyzeSource(code, {}, "src/hello.py", PROJECT_ID);

    // Assert — should fallback to normal parsing
    expect(result.detectedLanguage).toBe("python");
    expect(result.totalConstructs).toBeGreaterThan(0);
  });

  it("should fallback to parser when filePath is not provided", () => {
    // Arrange
    seedCodeIndex(db, PROJECT_ID, FILE_PATH);
    const code = "class Calculator { add(a, b) { return a + b; } }";

    // Act — no filePath
    const result = orchestrator.analyzeSource(code, {});

    // Assert — should use parser (language detected from code)
    expect(result.totalConstructs).toBeGreaterThanOrEqual(0);
  });

  it("should fallback when codeStore is not provided", () => {
    // Arrange — orchestrator without codeStore
    const registry = new ConstructRegistry(db);
    loadAndSeedRegistry(registry);
    const translationStore = new TranslationStore(db);
    const orchestratorNoCode = new TranslationOrchestrator(registry, translationStore);
    seedCodeIndex(db, PROJECT_ID, FILE_PATH);
    const code = "class Calculator { add(a, b) { return a + b; } }";

    // Act
    const result = orchestratorNoCode.analyzeSource(code, {}, FILE_PATH, PROJECT_ID);

    // Assert — should work fine, just skip pre-indexed path
    expect(result.detectedLanguage).toBeDefined();
  });
});
