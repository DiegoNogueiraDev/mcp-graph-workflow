import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { getIntegrationsStatus } from "../core/integrations/tool-status.js";

describe("getIntegrationsStatus", { timeout: 15_000 }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `tool-status-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ── Shape ──────────────────────────────────────────

  it("should return correct shape with all fields", async () => {
    const status = await getIntegrationsStatus(tmpDir);

    expect(status).toHaveProperty("gitnexus");
    expect(status).toHaveProperty("serena");
    expect(status).toHaveProperty("playwright");
    expect(status.gitnexus).toHaveProperty("installed");
    expect(status.gitnexus).toHaveProperty("running");
    expect(status.serena).toHaveProperty("installed");
    expect(status.serena).toHaveProperty("running");
    expect(status.serena).toHaveProperty("memories");
    expect(status.playwright).toHaveProperty("installed");
    expect(status.playwright).toHaveProperty("running");
    expect(Array.isArray(status.serena.memories)).toBe(true);
  });

  // ── Serena detection ──────────────────────────────

  it("should detect Serena when .serena/ dir exists with memory files", async () => {
    const memoriesDir = path.join(tmpDir, ".serena", "memories");
    mkdirSync(memoriesDir, { recursive: true });
    writeFileSync(path.join(memoriesDir, "architecture.md"), "# Architecture notes");
    writeFileSync(path.join(memoriesDir, "conventions.md"), "# Conventions");

    const status = await getIntegrationsStatus(tmpDir);

    expect(status.serena.installed).toBe(true);
    expect(status.serena.running).toBe(true);
    expect(status.serena.memories).toContain("architecture");
    expect(status.serena.memories).toContain("conventions");
    expect(status.serena.memories).toHaveLength(2);
  });

  it("should not detect Serena when no .serena/ dir exists", async () => {
    const status = await getIntegrationsStatus(tmpDir);

    expect(status.serena.installed).toBe(false);
    expect(status.serena.running).toBe(false);
    expect(status.serena.memories).toHaveLength(0);
  });

  it("should return empty memories when .serena/memories/ dir is empty", async () => {
    const memoriesDir = path.join(tmpDir, ".serena", "memories");
    mkdirSync(memoriesDir, { recursive: true });

    const status = await getIntegrationsStatus(tmpDir);

    expect(status.serena.installed).toBe(true);
    expect(status.serena.memories).toHaveLength(0);
  });

  // ── GitNexus ──────────────────────────────────────

  it("should report GitNexus not running when HTTP probe fails", async () => {
    const status = await getIntegrationsStatus(tmpDir);

    expect(status.gitnexus.running).toBe(false);
    expect(status.gitnexus.url).toBeUndefined();
  });

  it("should honor custom GITNEXUS_PORT env var", async () => {
    const originalPort = process.env.GITNEXUS_PORT;
    process.env.GITNEXUS_PORT = "9999";

    try {
      const status = await getIntegrationsStatus(tmpDir);
      // Port 9999 should not have a running service either
      expect(status.gitnexus.running).toBe(false);
    } finally {
      if (originalPort !== undefined) {
        process.env.GITNEXUS_PORT = originalPort;
      } else {
        delete process.env.GITNEXUS_PORT;
      }
    }
  });

  // ── Playwright ────────────────────────────────────

  it("should detect playwright based on npx availability", async () => {
    const status = await getIntegrationsStatus(tmpDir);

    // npx should be installed in any Node.js environment
    expect(typeof status.playwright.installed).toBe("boolean");
    expect(status.playwright.running).toBe(false);
  });

  // ── Serena edge case ──────────────────────────────

  it("should only include .md files in memories list", async () => {
    const memoriesDir = path.join(tmpDir, ".serena", "memories");
    mkdirSync(memoriesDir, { recursive: true });
    writeFileSync(path.join(memoriesDir, "notes.md"), "# Notes");
    writeFileSync(path.join(memoriesDir, "data.json"), "{}");
    writeFileSync(path.join(memoriesDir, "readme.txt"), "text");

    const status = await getIntegrationsStatus(tmpDir);

    expect(status.serena.memories).toEqual(["notes"]);
  });
});
