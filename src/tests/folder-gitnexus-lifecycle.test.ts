import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import express from "express";
import { createFolderRouter } from "../api/routes/folder.js";
import { STORE_DIR, DB_FILE } from "../core/utils/constants.js";

// Mock gitnexus-launcher to verify it's called on swap
vi.mock("../core/integrations/gitnexus-launcher.js", () => ({
  ensureGitNexusAnalyzed: vi.fn().mockResolvedValue({ skipped: true, reason: "mocked" }),
  startGitNexusServe: vi.fn().mockResolvedValue({ started: true, message: "mocked" }),
  stopGitNexus: vi.fn().mockResolvedValue(undefined),
}));

import { ensureGitNexusAnalyzed, startGitNexusServe } from "../core/integrations/gitnexus-launcher.js";

function createMockStoreManager(basePath: string, swapResult: unknown): unknown {
  return {
    basePath,
    recentFolders: [],
    swap: vi.fn().mockReturnValue(swapResult),
  };
}

describe("Folder router — GitNexus lifecycle on swap", () => {
  let tmpDir: string;
  let projectDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    const ts = Date.now();
    tmpDir = path.join(tmpdir(), `folder-gnx-test-${ts}`);
    projectDir = path.join(tmpDir, "project-a");
    mkdirSync(path.join(projectDir, STORE_DIR), { recursive: true });
    writeFileSync(path.join(projectDir, STORE_DIR, DB_FILE), "");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Swap triggers GitNexus lifecycle ────────────

  it("should trigger GitNexus analyze and serve after successful folder swap", async () => {
    const mock = createMockStoreManager(tmpDir, { ok: true, basePath: projectDir });

    const app = express();
    app.use(express.json());
    app.use("/api/v1/folder", createFolderRouter(mock as never, { gitnexusPort: 19995 }));

    const res = await request(app)
      .post("/api/v1/folder/open")
      .send({ path: projectDir });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Give async operations time to fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(ensureGitNexusAnalyzed).toHaveBeenCalledWith(projectDir);
    expect(startGitNexusServe).toHaveBeenCalledWith(projectDir, 19995);
  });

  it("should call ensureGitNexusAnalyzed before startGitNexusServe", async () => {
    const callOrder: string[] = [];
    vi.mocked(ensureGitNexusAnalyzed).mockImplementation(async () => {
      callOrder.push("analyze");
      return { skipped: true, reason: "mocked" };
    });
    vi.mocked(startGitNexusServe).mockImplementation(async () => {
      callOrder.push("serve");
      return { started: true, message: "mocked" };
    });

    const mock = createMockStoreManager(tmpDir, { ok: true, basePath: projectDir });

    const app = express();
    app.use(express.json());
    app.use("/api/v1/folder", createFolderRouter(mock as never, { gitnexusPort: 19996 }));

    await request(app)
      .post("/api/v1/folder/open")
      .send({ path: projectDir });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callOrder).toEqual(["analyze", "serve"]);
  });

  it("should pass the swapped basePath (not the old one) to GitNexus", async () => {
    const newProjectDir = path.join(tmpDir, "project-b");
    mkdirSync(path.join(newProjectDir, STORE_DIR), { recursive: true });
    writeFileSync(path.join(newProjectDir, STORE_DIR, DB_FILE), "");

    const mock = createMockStoreManager(tmpDir, { ok: true, basePath: newProjectDir });

    const app = express();
    app.use(express.json());
    app.use("/api/v1/folder", createFolderRouter(mock as never, { gitnexusPort: 19997 }));

    await request(app)
      .post("/api/v1/folder/open")
      .send({ path: newProjectDir });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Must use the NEW basePath, not the old one
    expect(ensureGitNexusAnalyzed).toHaveBeenCalledWith(newProjectDir);
    expect(startGitNexusServe).toHaveBeenCalledWith(newProjectDir, 19997);
  });

  // ── Swap failure ───────────────────────────────

  it("should NOT trigger GitNexus when swap fails", async () => {
    const mock = createMockStoreManager(tmpDir, { ok: false, error: "no db" });

    const app = express();
    app.use(express.json());
    app.use("/api/v1/folder", createFolderRouter(mock as never, { gitnexusPort: 19995 }));

    const res = await request(app)
      .post("/api/v1/folder/open")
      .send({ path: projectDir });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(ensureGitNexusAnalyzed).not.toHaveBeenCalled();
    expect(startGitNexusServe).not.toHaveBeenCalled();
  });

  // ── No gitnexusPort configured ─────────────────

  it("should NOT trigger GitNexus when gitnexusPort is not provided", async () => {
    const mock = createMockStoreManager(tmpDir, { ok: true, basePath: projectDir });

    const app = express();
    app.use(express.json());
    // No options → no gitnexusPort
    app.use("/api/v1/folder", createFolderRouter(mock as never));

    const res = await request(app)
      .post("/api/v1/folder/open")
      .send({ path: projectDir });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(ensureGitNexusAnalyzed).not.toHaveBeenCalled();
    expect(startGitNexusServe).not.toHaveBeenCalled();
  });

  // ── GitNexus failure is non-blocking ───────────

  it("should return 200 even when GitNexus analyze fails after swap", async () => {
    vi.mocked(ensureGitNexusAnalyzed).mockRejectedValueOnce(new Error("analyze boom"));

    const mock = createMockStoreManager(tmpDir, { ok: true, basePath: projectDir });

    const app = express();
    app.use(express.json());
    app.use("/api/v1/folder", createFolderRouter(mock as never, { gitnexusPort: 19998 }));

    const res = await request(app)
      .post("/api/v1/folder/open")
      .send({ path: projectDir });

    // Swap should succeed regardless of GitNexus failure
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // analyze was called but serve should NOT be called (promise chain rejected)
    expect(ensureGitNexusAnalyzed).toHaveBeenCalled();
    expect(startGitNexusServe).not.toHaveBeenCalled();
  });
});
