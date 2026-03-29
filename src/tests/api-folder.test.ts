import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import request from "supertest";
import express from "express";
import type { Express } from "express";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { StoreManager } from "../core/store/store-manager.js";
import { createFolderRouter } from "../api/routes/folder.js";
import { errorHandler } from "../api/middleware/error-handler.js";
import { STORE_DIR } from "../core/utils/constants.js";

function createTempProject(name: string): string {
  const dir = path.join(os.tmpdir(), `mcp-graph-api-folder-${name}-${Date.now()}`);
  mkdirSync(path.join(dir, STORE_DIR), { recursive: true });
  const store = SqliteStore.open(dir);
  store.initProject(name);
  store.close();
  return dir;
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("API /api/v1/folder", () => {
  let app: Express;
  let manager: StoreManager;
  let initialPath: string;
  const tempDirs: string[] = [];

  beforeEach(() => {
    initialPath = createTempProject("api-initial");
    tempDirs.push(initialPath);
    manager = StoreManager.create(initialPath);

    app = express();
    app.use(express.json());
    app.use("/api/v1/folder", createFolderRouter(manager));
    app.use(errorHandler);
  });

  afterEach(() => {
    manager.close();
    for (const dir of tempDirs) {
      cleanupDir(dir);
    }
    tempDirs.length = 0;
  });

  describe("GET /api/v1/folder", () => {
    it("should return current path and recent folders", async () => {
      const res = await request(app).get("/api/v1/folder");

      expect(res.status).toBe(200);
      expect(res.body.currentPath).toBe(initialPath);
      expect(Array.isArray(res.body.recentFolders)).toBe(true);
    });
  });

  describe("POST /api/v1/folder/open", () => {
    it("should swap store to valid path", async () => {
      const newPath = createTempProject("api-swap");
      tempDirs.push(newPath);

      const res = await request(app)
        .post("/api/v1/folder/open")
        .send({ path: newPath });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.basePath).toBe(newPath);

      // Verify current path changed
      const getRes = await request(app).get("/api/v1/folder");
      expect(getRes.body.currentPath).toBe(newPath);
    });

    it("should return 400 for invalid path", async () => {
      const res = await request(app)
        .post("/api/v1/folder/open")
        .send({ path: "/nonexistent/path" });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 for empty path", async () => {
      const res = await request(app)
        .post("/api/v1/folder/open")
        .send({ path: "" });

      expect(res.status).toBe(400);
    });

    it("should return 400 for missing path", async () => {
      const res = await request(app)
        .post("/api/v1/folder/open")
        .send({});

      expect(res.status).toBe(400);
    });

    it("should use new store for subsequent requests after swap", async () => {
      const newPath = createTempProject("api-subsequent");
      tempDirs.push(newPath);

      await request(app)
        .post("/api/v1/folder/open")
        .send({ path: newPath });

      // The storeRef should now point to the new store
      expect(manager.basePath).toBe(newPath);
      expect(manager.store.getProject()?.name).toBe("api-subsequent");
    });
  });

  describe("GET /api/v1/folder/browse", () => {
    it("should list directories at given path", async () => {
      // initialPath has a workflow-graph/ subdirectory
      const res = await request(app)
        .get(`/api/v1/folder/browse?path=${encodeURIComponent(initialPath)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.entries)).toBe(true);
      expect(res.body.path).toBe(initialPath);

      const wfEntry = res.body.entries.find((e: { name: string }) => e.name === STORE_DIR);
      expect(wfEntry).toBeDefined();
      expect(wfEntry.isDirectory).toBe(true);
    });

    it("should mark directories containing graph.db with hasGraph", async () => {
      // The initialPath itself contains workflow-graph/graph.db
      // Go up one level and browse — the project dir should have hasGraph=true
      const parentDir = path.dirname(initialPath);
      const res = await request(app)
        .get(`/api/v1/folder/browse?path=${encodeURIComponent(parentDir)}`);

      expect(res.status).toBe(200);
      const projectEntry = res.body.entries.find(
        (e: { name: string }) => e.name === path.basename(initialPath),
      );
      expect(projectEntry).toBeDefined();
      expect(projectEntry.hasGraph).toBe(true);
    });

    it("should return error for nonexistent path", async () => {
      // Path outside home directory returns 403; nonexistent path under home returns 400
      const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
      const res = await request(app)
        .get(`/api/v1/folder/browse?path=${encodeURIComponent(home + "/nonexistent_abc123_xyz")}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 if path is missing", async () => {
      const res = await request(app).get("/api/v1/folder/browse");
      expect(res.status).toBe(400);
    });

    it("should only list directories, not files", async () => {
      // Create a file alongside directories
      writeFileSync(path.join(initialPath, "some-file.txt"), "test");

      const res = await request(app)
        .get(`/api/v1/folder/browse?path=${encodeURIComponent(initialPath)}`);

      expect(res.status).toBe(200);
      const fileEntry = res.body.entries.find((e: { name: string }) => e.name === "some-file.txt");
      expect(fileEntry).toBeUndefined();
    });

    it("should not list hidden directories by default", async () => {
      mkdirSync(path.join(initialPath, ".hidden-dir"), { recursive: true });

      const res = await request(app)
        .get(`/api/v1/folder/browse?path=${encodeURIComponent(initialPath)}`);

      expect(res.status).toBe(200);
      const hiddenEntry = res.body.entries.find((e: { name: string }) => e.name === ".hidden-dir");
      expect(hiddenEntry).toBeUndefined();
    });
  });
});
