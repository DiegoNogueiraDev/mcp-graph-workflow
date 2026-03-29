import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { STORE_DIR, DB_FILE } from "../core/utils/constants.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("SqliteStore — global mode methods", () => {
  describe("openDb (static)", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = path.join(os.tmpdir(), `store-opendb-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should open a DB by absolute path", () => {
      const storeDir = path.join(tmpDir, STORE_DIR);
      mkdirSync(storeDir, { recursive: true });
      const dbPath = path.join(storeDir, DB_FILE);

      const store = SqliteStore.openDb(dbPath);
      expect(store).toBeDefined();
      expect(store.getProject()).toBeNull(); // No project yet

      store.close();
    });

    it("should create DB file if it does not exist", () => {
      const dbPath = path.join(tmpDir, "new-db.db");

      const store = SqliteStore.openDb(dbPath);
      expect(store).toBeDefined();

      // Should be able to init a project
      const project = store.initProject("Test");
      expect(project.name).toBe("Test");

      store.close();
    });

    it("should run migrations on the opened DB", () => {
      const dbPath = path.join(tmpDir, "migrated.db");

      const store = SqliteStore.openDb(dbPath);
      const db = store.getDb();

      // Check _migrations table exists and has all migrations
      const migrations = db
        .prepare("SELECT version FROM _migrations ORDER BY version")
        .all() as Array<{ version: number }>;

      expect(migrations.length).toBe(19);

      store.close();
    });
  });

  describe("findProjectByPath", () => {
    let store: SqliteStore;

    beforeEach(() => {
      store = SqliteStore.open(":memory:");
    });

    afterEach(() => {
      store.close();
    });

    it("should return null when no project matches the path", () => {
      store.initProject("Test");
      const found = store.findProjectByPath("/some/random/path");
      expect(found).toBeNull();
    });

    it("should find a project by its fs_path", () => {
      const project = store.initProject("My Project");
      store.setProjectFsPath(project.id, "/home/user/my-project");

      const found = store.findProjectByPath("/home/user/my-project");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(project.id);
      expect(found!.name).toBe("My Project");
      expect(found!.fsPath).toBe("/home/user/my-project");
    });

    it("should return null when path does not match exactly", () => {
      const project = store.initProject("My Project");
      store.setProjectFsPath(project.id, "/home/user/my-project");

      expect(store.findProjectByPath("/home/user/my-project/sub")).toBeNull();
      expect(store.findProjectByPath("/home/user/my")).toBeNull();
    });
  });

  describe("registerProject", () => {
    let store: SqliteStore;

    beforeEach(() => {
      store = SqliteStore.open(":memory:");
    });

    afterEach(() => {
      store.close();
    });

    it("should create a new project with fs_path", () => {
      const project = store.registerProject("New Project", "/home/user/new-project");

      expect(project.id).toBeTruthy();
      expect(project.name).toBe("New Project");
      expect(project.fsPath).toBe("/home/user/new-project");
    });

    it("should return existing project if fs_path already registered", () => {
      const first = store.registerProject("Project A", "/home/user/project-a");
      const second = store.registerProject("Project A Renamed", "/home/user/project-a");

      expect(second.id).toBe(first.id);
      expect(second.name).toBe("Project A"); // Name unchanged
    });

    it("should activate the registered project", () => {
      const project = store.registerProject("Registered", "/home/user/registered");

      const active = store.getProject();
      expect(active).not.toBeNull();
      expect(active!.id).toBe(project.id);
    });

    it("should allow multiple projects with different paths", () => {
      const p1 = store.registerProject("Project 1", "/path/1");
      const p2 = store.registerProject("Project 2", "/path/2");

      expect(p1.id).not.toBe(p2.id);

      const found1 = store.findProjectByPath("/path/1");
      const found2 = store.findProjectByPath("/path/2");
      expect(found1!.id).toBe(p1.id);
      expect(found2!.id).toBe(p2.id);
    });
  });

  describe("setProjectFsPath", () => {
    let store: SqliteStore;

    beforeEach(() => {
      store = SqliteStore.open(":memory:");
    });

    afterEach(() => {
      store.close();
    });

    it("should set fs_path for an existing project", () => {
      const project = store.initProject("Test");
      store.setProjectFsPath(project.id, "/home/user/test");

      const found = store.findProjectByPath("/home/user/test");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(project.id);
    });

    it("should update fs_path if already set", () => {
      const project = store.initProject("Test");
      store.setProjectFsPath(project.id, "/old/path");
      store.setProjectFsPath(project.id, "/new/path");

      expect(store.findProjectByPath("/old/path")).toBeNull();
      expect(store.findProjectByPath("/new/path")).not.toBeNull();
    });
  });

  describe("getProject with fsPath", () => {
    let store: SqliteStore;

    beforeEach(() => {
      store = SqliteStore.open(":memory:");
    });

    afterEach(() => {
      store.close();
    });

    it("should include fsPath in getProject() result", () => {
      store.registerProject("With Path", "/home/user/project");

      const retrieved = store.getProject();
      expect(retrieved).not.toBeNull();
      expect(retrieved!.fsPath).toBe("/home/user/project");
    });

    it("should include fsPath in listProjects() results", () => {
      store.registerProject("P1", "/path/1");
      store.registerProject("P2", "/path/2");

      const projects = store.listProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0].fsPath).toBe("/path/1");
      expect(projects[1].fsPath).toBe("/path/2");
    });

    it("should return undefined fsPath for legacy projects without fs_path", () => {
      store.initProject("Legacy");

      const project = store.getProject();
      expect(project).not.toBeNull();
      expect(project!.fsPath).toBeUndefined();
    });
  });
});

describe("SqliteStore — regression guards", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Regression Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should still insert and retrieve nodes after migration 8", () => {
    const node = makeNode({ title: "Regression node" });
    store.insertNode(node);

    const retrieved = store.getNodeById(node.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe("Regression node");
  });

  it("should still insert and retrieve edges after migration 8", () => {
    const n1 = makeNode();
    const n2 = makeNode();
    store.insertNode(n1);
    store.insertNode(n2);

    const edge = makeEdge(n1.id, n2.id);
    store.insertEdge(edge);

    const edges = store.getEdgesFrom(n1.id);
    expect(edges).toHaveLength(1);
  });

  it("should still search nodes after migration 8", () => {
    const node = makeNode({ title: "Searchable task" });
    store.insertNode(node);

    const results = store.searchNodes("Searchable");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should still create and restore snapshots after migration 8", () => {
    store.insertNode(makeNode({ title: "Snapshot test" }));

    const snapshotId = store.createSnapshot();
    expect(snapshotId).toBeGreaterThan(0);

    store.insertNode(makeNode({ title: "After snapshot" }));
    expect(store.getAllNodes()).toHaveLength(2);

    store.restoreSnapshot(snapshotId);
    expect(store.getAllNodes()).toHaveLength(1);
  });

  it("should still handle multi-project switching after migration 8", () => {
    const p1 = store.getProject()!;
    const p2 = store.initProject("Project 2");

    expect(p2.id).not.toBe(p1.id);

    store.activateProject(p1.id);
    expect(store.getProject()!.id).toBe(p1.id);

    store.activateProject(p2.id);
    expect(store.getProject()!.id).toBe(p2.id);
  });

  it("should still compute stats after migration 8", () => {
    store.insertNode(makeNode({ type: "task", status: "backlog" }));
    store.insertNode(makeNode({ type: "epic", status: "done" }));

    const stats = store.getStats();
    expect(stats.totalNodes).toBe(2);
    expect(stats.byType["task"]).toBe(1);
    expect(stats.byType["epic"]).toBe(1);
  });
});
