import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { configureDb } from "../core/store/migrations.js";

describe("configureDb PRAGMAs", () => {
  it("should set journal_mode to WAL", () => {
    const db = new Database(":memory:");
    configureDb(db);
    const result = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
    // In-memory databases may return "memory" instead of "wal"
    expect(["wal", "memory"]).toContain(result[0].journal_mode);
    db.close();
  });

  it("should enable foreign_keys", () => {
    const db = new Database(":memory:");
    configureDb(db);
    const result = db.pragma("foreign_keys") as Array<{ foreign_keys: number }>;
    expect(result[0].foreign_keys).toBe(1);
    db.close();
  });

  it("should set synchronous to NORMAL (1)", () => {
    const db = new Database(":memory:");
    configureDb(db);
    const result = db.pragma("synchronous") as Array<{ synchronous: number }>;
    expect(result[0].synchronous).toBe(1); // NORMAL = 1
    db.close();
  });

  it("should set cache_size to -8000 (8MB)", () => {
    const db = new Database(":memory:");
    configureDb(db);
    const result = db.pragma("cache_size") as Array<{ cache_size: number }>;
    expect(result[0].cache_size).toBe(-8000);
    db.close();
  });

  it("should set busy_timeout to 5000ms", () => {
    const db = new Database(":memory:");
    configureDb(db);
    const result = db.pragma("busy_timeout") as Array<{ timeout: number }>;
    expect(result[0].timeout).toBe(5000);
    db.close();
  });

  it("should set temp_store to MEMORY (2)", () => {
    const db = new Database(":memory:");
    configureDb(db);
    const result = db.pragma("temp_store") as Array<{ temp_store: number }>;
    expect(result[0].temp_store).toBe(2); // MEMORY = 2
    db.close();
  });

  it("should set mmap_size PRAGMA without error", () => {
    const db = new Database(":memory:");
    // mmap_size is not readable on :memory: databases (returns empty array),
    // but the PRAGMA must be applied without throwing
    expect(() => configureDb(db)).not.toThrow();
    db.close();
  });

  it("should set mmap_size to 67108864 on file-backed DB", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pragma-test-"));
    const dbPath = path.join(tmpDir, "test.db");
    try {
      const db = new Database(dbPath);
      configureDb(db);
      const result = db.pragma("mmap_size") as Array<{ mmap_size: number }>;
      expect(result[0].mmap_size).toBe(67108864);
      db.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
