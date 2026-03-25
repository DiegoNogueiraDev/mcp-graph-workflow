import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration 8 — fs_path + knowledge project_id", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should add fs_path column to projects table", () => {
    const columns = db
      .prepare("PRAGMA table_info(projects)")
      .all() as Array<{ name: string; type: string }>;
    const fsPathCol = columns.find((c) => c.name === "fs_path");

    expect(fsPathCol).toBeDefined();
    expect(fsPathCol!.type).toBe("TEXT");
  });

  it("should create index on projects.fs_path", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='projects'")
      .all() as Array<{ name: string }>;

    expect(indexes.some((i) => i.name === "idx_projects_fs_path")).toBe(true);
  });

  it("should add project_id column to knowledge_documents table", () => {
    const columns = db
      .prepare("PRAGMA table_info(knowledge_documents)")
      .all() as Array<{ name: string; type: string; notnull: number }>;
    const projectIdCol = columns.find((c) => c.name === "project_id");

    expect(projectIdCol).toBeDefined();
    expect(projectIdCol!.type).toBe("TEXT");
    // Should be nullable for backward compat
    expect(projectIdCol!.notnull).toBe(0);
  });

  it("should create index on knowledge_documents.project_id", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='knowledge_documents'")
      .all() as Array<{ name: string }>;

    expect(indexes.some((i) => i.name === "idx_knowledge_project")).toBe(true);
  });

  it("should allow NULL project_id for backward compatibility", () => {
    const timestamp = new Date().toISOString();
    // Insert knowledge doc without project_id
    db.prepare(
      `INSERT INTO knowledge_documents
        (id, source_type, source_id, title, content, content_hash, chunk_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("kdoc_test1", "memory", "src1", "Test", "content", "hash1", 0, timestamp, timestamp);

    const row = db
      .prepare("SELECT project_id FROM knowledge_documents WHERE id = ?")
      .get("kdoc_test1") as { project_id: string | null };

    expect(row.project_id).toBeNull();
  });

  it("should allow storing project_id in knowledge_documents", () => {
    const timestamp = new Date().toISOString();
    db.prepare(
      `INSERT INTO knowledge_documents
        (id, source_type, source_id, title, content, content_hash, chunk_index, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("kdoc_test2", "memory", "src2", "Test", "content", "hash2", 0, "proj_abc", timestamp, timestamp);

    const row = db
      .prepare("SELECT project_id FROM knowledge_documents WHERE id = ?")
      .get("kdoc_test2") as { project_id: string | null };

    expect(row.project_id).toBe("proj_abc");
  });

  it("should allow NULL fs_path for backward compatibility", () => {
    const timestamp = new Date().toISOString();
    db.prepare(
      "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run("proj_test1", "Test Project", timestamp, timestamp);

    const row = db
      .prepare("SELECT fs_path FROM projects WHERE id = ?")
      .get("proj_test1") as { fs_path: string | null };

    expect(row.fs_path).toBeNull();
  });

  it("should allow storing fs_path in projects", () => {
    const timestamp = new Date().toISOString();
    db.prepare(
      "INSERT INTO projects (id, name, fs_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("proj_test2", "Test Project", "/home/user/my-project", timestamp, timestamp);

    const row = db
      .prepare("SELECT fs_path FROM projects WHERE id = ?")
      .get("proj_test2") as { fs_path: string | null };

    expect(row.fs_path).toBe("/home/user/my-project");
  });

  it("should run idempotently (all 8 migrations)", () => {
    // Already ran once in beforeEach — verify _migrations table
    const migrations = db
      .prepare("SELECT version FROM _migrations ORDER BY version")
      .all() as Array<{ version: number }>;

    expect(migrations.length).toBe(12);
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});
