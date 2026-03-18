import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { resolveStorePath } from "../core/store/path-resolver.js";
import { STORE_DIR, DB_FILE, GLOBAL_STORE_DIR } from "../core/utils/constants.js";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("resolveStorePath", () => {
  let tmpDir: string;
  let fakeGlobalDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `path-resolver-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    // Use a fake global dir inside tmp to avoid polluting real ~/.mcp-graph
    fakeGlobalDir = path.join(tmpDir, "fake-home", GLOBAL_STORE_DIR);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return explicit mode when explicitDb is provided", () => {
    const dbPath = path.join(tmpDir, "custom.db");
    writeFileSync(dbPath, ""); // touch file

    const result = resolveStorePath({
      explicitDb: dbPath,
      cwd: tmpDir,
      globalDir: fakeGlobalDir,
    });

    expect(result.mode).toBe("explicit");
    expect(result.dbPath).toBe(dbPath);
  });

  it("should return local mode when local DB exists", () => {
    // Arrange: create local workflow-graph/graph.db
    const localStoreDir = path.join(tmpDir, STORE_DIR);
    mkdirSync(localStoreDir, { recursive: true });
    const localDbPath = path.join(localStoreDir, DB_FILE);
    const db = new Database(localDbPath);
    configureDb(db);
    runMigrations(db);
    db.close();

    const result = resolveStorePath({
      cwd: tmpDir,
      globalDir: fakeGlobalDir,
    });

    expect(result.mode).toBe("local");
    expect(result.dbPath).toBe(localDbPath);
    expect(result.basePath).toBe(tmpDir);
    expect(result.memoriesPath).toBe(path.join(localStoreDir, "memories"));
  });

  it("should return global mode when no local DB exists but global does", () => {
    // Arrange: create global DB
    mkdirSync(fakeGlobalDir, { recursive: true });
    const globalDbPath = path.join(fakeGlobalDir, DB_FILE);
    const db = new Database(globalDbPath);
    configureDb(db);
    runMigrations(db);
    db.close();

    const cwd = path.join(tmpDir, "some-project");
    mkdirSync(cwd, { recursive: true });

    const result = resolveStorePath({
      cwd,
      globalDir: fakeGlobalDir,
    });

    expect(result.mode).toBe("global");
    expect(result.dbPath).toBe(globalDbPath);
    expect(result.basePath).toBe(cwd);
  });

  it("should prefer local over global when both exist", () => {
    // Arrange: create both
    const localStoreDir = path.join(tmpDir, STORE_DIR);
    mkdirSync(localStoreDir, { recursive: true });
    const localDbPath = path.join(localStoreDir, DB_FILE);
    const localDb = new Database(localDbPath);
    configureDb(localDb);
    runMigrations(localDb);
    localDb.close();

    mkdirSync(fakeGlobalDir, { recursive: true });
    const globalDbPath = path.join(fakeGlobalDir, DB_FILE);
    const globalDb = new Database(globalDbPath);
    configureDb(globalDb);
    runMigrations(globalDb);
    globalDb.close();

    const result = resolveStorePath({
      cwd: tmpDir,
      globalDir: fakeGlobalDir,
    });

    expect(result.mode).toBe("local");
    expect(result.dbPath).toBe(localDbPath);
  });

  it("should return global mode with project-scoped memories path", () => {
    mkdirSync(fakeGlobalDir, { recursive: true });
    const globalDbPath = path.join(fakeGlobalDir, DB_FILE);
    const db = new Database(globalDbPath);
    configureDb(db);
    runMigrations(db);
    db.close();

    const cwd = path.join(tmpDir, "my-project");
    mkdirSync(cwd, { recursive: true });

    const result = resolveStorePath({
      cwd,
      globalDir: fakeGlobalDir,
      projectId: "proj_abc123",
    });

    expect(result.mode).toBe("global");
    expect(result.memoriesPath).toBe(path.join(fakeGlobalDir, "memories", "proj_abc123"));
  });

  it("should throw when no DB can be found and createGlobal is false", () => {
    const cwd = path.join(tmpDir, "empty-project");
    mkdirSync(cwd, { recursive: true });

    expect(() =>
      resolveStorePath({
        cwd,
        globalDir: fakeGlobalDir,
        createGlobal: false,
      }),
    ).toThrow("No graph database found");
  });

  it("should create global DB when createGlobal is true and no DB exists", () => {
    const cwd = path.join(tmpDir, "new-project");
    mkdirSync(cwd, { recursive: true });

    const result = resolveStorePath({
      cwd,
      globalDir: fakeGlobalDir,
      createGlobal: true,
    });

    expect(result.mode).toBe("global");
    expect(existsSync(result.dbPath)).toBe(true);
  });
});
