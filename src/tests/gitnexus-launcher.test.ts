import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  isGitNexusIndexed,
  ensureGitNexusAnalyzed,
  startGitNexusServe,
  stopGitNexus,
  isGitNexusRunning,
} from "../core/integrations/gitnexus-launcher.js";

describe("gitnexus-launcher", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `gitnexus-launcher-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    // Always attempt cleanup of spawned processes
    await stopGitNexus();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ── isGitNexusIndexed ─────────────────────────────

  describe("isGitNexusIndexed", () => {
    it("should return false when .gitnexus/ directory does not exist", () => {
      const result = isGitNexusIndexed(tmpDir);
      expect(result).toBe(false);
    });

    it("should return true when .gitnexus/ directory exists", () => {
      mkdirSync(path.join(tmpDir, ".gitnexus"), { recursive: true });
      const result = isGitNexusIndexed(tmpDir);
      expect(result).toBe(true);
    });
  });

  // ── isGitNexusRunning ─────────────────────────────

  describe("isGitNexusRunning", () => {
    it("should return false when nothing is running on the port", async () => {
      const result = await isGitNexusRunning(19999);
      expect(result).toBe(false);
    });
  });

  // ── ensureGitNexusAnalyzed ────────────────────────

  describe("ensureGitNexusAnalyzed", { timeout: 120_000 }, () => {
    it("should skip analysis when .gitnexus/ already exists", async () => {
      mkdirSync(path.join(tmpDir, ".gitnexus"), { recursive: true });

      const result = await ensureGitNexusAnalyzed(tmpDir);

      expect(result.skipped).toBe(true);
      expect(result.reason).toMatch(/already indexed/i);
    });

    it("should attempt analysis when .gitnexus/ does not exist", async () => {
      const result = await ensureGitNexusAnalyzed(tmpDir);

      // May fail if gitnexus is not installed, but should not throw
      expect(result).toHaveProperty("skipped");
      expect(result).toHaveProperty("reason");
      expect(typeof result.skipped).toBe("boolean");
    });

    it("should return failure info when gitnexus is not available", async () => {
      // In a clean tmpDir without gitnexus, should report failure gracefully
      const result = await ensureGitNexusAnalyzed(tmpDir);

      if (!result.skipped) {
        // If it tried to run, it should report success or failure
        expect(result).toHaveProperty("success");
      }
    });
  });

  // ── startGitNexusServe ────────────────────────────

  describe("startGitNexusServe", () => {
    it("should return status object with started flag", async () => {
      const result = await startGitNexusServe(tmpDir, 19998);

      expect(result).toHaveProperty("started");
      expect(typeof result.started).toBe("boolean");
      expect(result).toHaveProperty("message");
    });

    it("should report not started when gitnexus is not indexed", async () => {
      // No .gitnexus/ dir = nothing to serve
      const result = await startGitNexusServe(tmpDir, 19997);

      expect(result.started).toBe(false);
    });
  });

  // ── stopGitNexus ──────────────────────────────────

  describe("stopGitNexus", () => {
    it("should not throw when no process is running", async () => {
      await expect(stopGitNexus()).resolves.not.toThrow();
    });
  });
});
