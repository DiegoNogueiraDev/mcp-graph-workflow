import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";

describe("Migration v15 — Translation + UCR tables", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
  });

  it("should create translation_jobs table with all columns", () => {
    const columns = db.prepare("PRAGMA table_info(translation_jobs)").all() as Array<{ name: string; type: string; notnull: number }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("project_id");
    expect(columnNames).toContain("source_language");
    expect(columnNames).toContain("target_language");
    expect(columnNames).toContain("source_code");
    expect(columnNames).toContain("target_code");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("scope");
    expect(columnNames).toContain("constraints");
    expect(columnNames).toContain("analysis");
    expect(columnNames).toContain("result");
    expect(columnNames).toContain("evidence");
    expect(columnNames).toContain("confidence_score");
    expect(columnNames).toContain("warnings");
    expect(columnNames).toContain("error_message");
    expect(columnNames).toContain("created_at");
    expect(columnNames).toContain("updated_at");
  });

  it("should create ucr_categories table", () => {
    const columns = db.prepare("PRAGMA table_info(ucr_categories)").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("name");
    expect(names).toContain("description");
  });

  it("should create ucr_constructs table", () => {
    const columns = db.prepare("PRAGMA table_info(ucr_constructs)").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("category_id");
    expect(names).toContain("canonical_name");
    expect(names).toContain("semantic_group");
    expect(names).toContain("metadata");
  });

  it("should create ucr_language_mappings table", () => {
    const columns = db.prepare("PRAGMA table_info(ucr_language_mappings)").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("construct_id");
    expect(names).toContain("language_id");
    expect(names).toContain("syntax_pattern");
    expect(names).toContain("ast_node_type");
    expect(names).toContain("confidence");
    expect(names).toContain("is_primary");
    expect(names).toContain("constraints");
  });

  it("should create ucr_equivalence_classes table", () => {
    const columns = db.prepare("PRAGMA table_info(ucr_equivalence_classes)").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("name");
    expect(names).toContain("equivalence_type");
  });

  it("should create ucr_translation_log table", () => {
    const columns = db.prepare("PRAGMA table_info(ucr_translation_log)").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("source_lang");
    expect(names).toContain("target_lang");
    expect(names).toContain("construct_id");
    expect(names).toContain("mapping_id");
    expect(names).toContain("success");
  });

  it("should create indexes on translation_jobs", () => {
    const indexes = db.prepare("PRAGMA index_list(translation_jobs)").all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames.some((n) => n.includes("project"))).toBe(true);
    expect(indexNames.some((n) => n.includes("status"))).toBe(true);
    expect(indexNames.some((n) => n.includes("lang"))).toBe(true);
  });

  it("should insert and query a translation job", () => {
    db.prepare(`
      INSERT INTO translation_jobs (id, project_id, source_language, target_language, source_code, status, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("job_001", "proj_abc", "typescript", "python", "const x = 1;", "pending", "snippet", "2026-03-28T00:00:00Z", "2026-03-28T00:00:00Z");

    const row = db.prepare("SELECT * FROM translation_jobs WHERE id = ?").get("job_001") as Record<string, unknown>;
    expect(row.source_language).toBe("typescript");
    expect(row.target_language).toBe("python");
    expect(row.status).toBe("pending");
  });

  it("should insert and query UCR data", () => {
    db.prepare("INSERT INTO ucr_categories (id, name) VALUES (?, ?)").run("control_flow", "Control Flow");
    db.prepare("INSERT INTO ucr_constructs (id, category_id, canonical_name) VALUES (?, ?, ?)").run("uc_if", "control_flow", "if_else");
    db.prepare(`
      INSERT INTO ucr_language_mappings (id, construct_id, language_id, syntax_pattern, confidence, is_primary)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("map_if_ts", "uc_if", "typescript", "if ({{cond}}) { {{body}} }", 1.0, 1);

    const mapping = db.prepare("SELECT * FROM ucr_language_mappings WHERE construct_id = ? AND language_id = ?").get("uc_if", "typescript") as Record<string, unknown>;
    expect(mapping.syntax_pattern).toBe("if ({{cond}}) { {{body}} }");
    expect(mapping.confidence).toBe(1.0);
  });

  it("should record migration v15 in _migrations table", () => {
    const row = db.prepare("SELECT * FROM _migrations WHERE version = 15").get() as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    expect((row?.description as string).toLowerCase()).toContain("translation");
  });
});
