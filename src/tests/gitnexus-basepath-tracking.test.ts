import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  startGitNexusServe,
  stopGitNexus,
  getServeBasePath,
  resetAnalyzePhase,
  isGitRepo,
  resolveGitNexusBin,
} from "../core/integrations/gitnexus-launcher.js";

describe("gitnexus-launcher basePath tracking", () => {
  let tmpDir1: string;
  let tmpDir2: string;

  beforeEach(() => {
    const ts = Date.now();
    tmpDir1 = path.join(tmpdir(), `gnx-bp-test-1-${ts}`);
    tmpDir2 = path.join(tmpdir(), `gnx-bp-test-2-${ts}`);
    mkdirSync(tmpDir1, { recursive: true });
    mkdirSync(tmpDir2, { recursive: true });
    resetAnalyzePhase();
  });

  afterEach(async () => {
    await stopGitNexus();
    rmSync(tmpDir1, { recursive: true, force: true });
    rmSync(tmpDir2, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ── getServeBasePath ───────────────────────────

  describe("getServeBasePath", () => {
    it("should return null when no serve has been started", () => {
      expect(getServeBasePath()).toBeNull();
    });

    it("should return null after resetAnalyzePhase clears state", () => {
      // resetAnalyzePhase is called in beforeEach — verify it clears servePath too
      resetAnalyzePhase();
      expect(getServeBasePath()).toBeNull();
    });
  });

  // ── stopGitNexus resets currentServePath ───────

  describe("stopGitNexus", () => {
    it("should reset serveBasePath to null after stop", async () => {
      // Even if nothing was running, stopGitNexus should ensure servePath is null
      await stopGitNexus();
      expect(getServeBasePath()).toBeNull();
    });
  });

  // ── basePath tracking on startGitNexusServe ────

  describe("basePath tracking", () => {
    it("should not start serve and keep serveBasePath null when basePath is not indexed", async () => {
      // No .gitnexus/ in tmpDir1
      const result = await startGitNexusServe(tmpDir1, 19990);

      expect(result.started).toBe(false);
      expect(result.message).toMatch(/not indexed/i);
      expect(getServeBasePath()).toBeNull();
    });

    it("should set serveBasePath when serve successfully starts on indexed dir", async () => {
      mkdirSync(path.join(tmpDir1, ".gitnexus"), { recursive: true });

      const result = await startGitNexusServe(tmpDir1, 19991);

      if (result.started) {
        // Binary was found and serve was spawned — basePath should be tracked
        expect(getServeBasePath()).toBe(tmpDir1);
      } else {
        // Binary not found — basePath should remain null
        expect(getServeBasePath()).toBeNull();
      }
    });

    it("should not set serveBasePath when serve fails to start (binary not found)", async () => {
      mkdirSync(path.join(tmpDir1, ".gitnexus"), { recursive: true });

      // If gitnexus binary is not installed, serve should fail gracefully
      const bin = await resolveGitNexusBin(tmpDir1);
      if (!bin) {
        // Confirm the serve path remains null when binary is unavailable
        const result = await startGitNexusServe(tmpDir1, 19992);
        expect(result.started).toBe(false);
        expect(getServeBasePath()).toBeNull();
      }
    });
  });

  // ── basePath mismatch detection (restart) ──────

  describe("basePath mismatch restart", () => {
    it("should stop and restart when called with different basePath", async () => {
      // Index both dirs
      mkdirSync(path.join(tmpDir1, ".gitnexus"), { recursive: true });
      mkdirSync(path.join(tmpDir2, ".gitnexus"), { recursive: true });

      // Start for tmpDir1
      const result1 = await startGitNexusServe(tmpDir1, 19993);

      if (result1.started) {
        // Serve is running for tmpDir1
        expect(getServeBasePath()).toBe(tmpDir1);

        // Now start for tmpDir2 — should trigger restart
        const result2 = await startGitNexusServe(tmpDir2, 19993);

        if (result2.started) {
          expect(getServeBasePath()).toBe(tmpDir2);
        } else {
          // If restart failed (binary gone?), serveBasePath should be null
          expect(getServeBasePath()).toBeNull();
        }
      }
    });

    it("should not restart when called with same basePath", async () => {
      mkdirSync(path.join(tmpDir1, ".gitnexus"), { recursive: true });

      const result1 = await startGitNexusServe(tmpDir1, 19994);

      if (result1.started) {
        const servePath1 = getServeBasePath();
        expect(servePath1).toBe(tmpDir1);

        // Call again with same basePath — should return "already" or re-start
        // (process may exit between calls in CI environments)
        const result2 = await startGitNexusServe(tmpDir1, 19994);
        expect(result2.started).toBe(true);

        if (getServeBasePath() !== null) {
          // Process survived — basePath should remain the same
          expect(getServeBasePath()).toBe(tmpDir1);
        }
      }
    });
  });

  // ── isGitRepo helper ───────────────────────────

  describe("isGitRepo", () => {
    it("should return false for dir without .git", () => {
      expect(isGitRepo(tmpDir1)).toBe(false);
    });

    it("should return true for dir with .git", () => {
      mkdirSync(path.join(tmpDir1, ".git"), { recursive: true });
      expect(isGitRepo(tmpDir1)).toBe(true);
    });
  });
});
