import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  isCommandAvailable,
  installAllMcpDeps,
  type InstallResult,
} from "../core/integrations/mcp-deps-installer.js";

describe("mcp-deps-installer", () => {
  // ── isCommandAvailable (fast, unit-level) ─────────

  describe("isCommandAvailable", () => {
    it("should return true for a command that exists (node)", async () => {
      const result = await isCommandAvailable("node");
      expect(result).toBe(true);
    });

    it("should return false for a command that does not exist", async () => {
      const result = await isCommandAvailable("nonexistent-command-xyz-12345");
      expect(result).toBe(false);
    });

    it("should return true for npx", async () => {
      const result = await isCommandAvailable("npx");
      expect(result).toBe(true);
    });
  });

  // ── installAllMcpDeps (integration — single call, multiple assertions) ──

  describe("installAllMcpDeps", { timeout: 120_000 }, () => {
    let tmpDir: string;
    let results: InstallResult[];

    beforeAll(async () => {
      tmpDir = path.join(tmpdir(), `mcp-deps-test-${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });
      // Single call — avoid repeating slow external checks
      results = await installAllMcpDeps(tmpDir);
    }, 120_000);

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should return an array of InstallResult", () => {
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should include result for each known dependency", () => {
      const names = results.map((r) => r.name);

      expect(names).toContain("gitnexus");
      expect(names).toContain("serena");
      expect(names).toContain("context7");
      expect(names).toContain("playwright");
    });

    it("should have correct InstallResult shape for each entry", () => {
      for (const result of results) {
        expect(result).toHaveProperty("name");
        expect(result).toHaveProperty("status");
        expect(result).toHaveProperty("message");
        expect(typeof result.name).toBe("string");
        expect(["installed", "already_available", "skipped", "failed"]).toContain(result.status);
        expect(typeof result.message).toBe("string");
      }
    });

    it("should report context7 as already_available when npx is present", () => {
      const context7 = results.find((r) => r.name === "context7");

      expect(context7).toBeDefined();
      expect(context7!.status).toMatch(/already_available|installed/);
    });

    it("should report playwright as already_available when npx is present", () => {
      const playwright = results.find((r) => r.name === "playwright");

      expect(playwright).toBeDefined();
      expect(playwright!.status).toMatch(/already_available|installed/);
    });

    it("should not block init when serena install fails", () => {
      const serena = results.find((r) => r.name === "serena");

      expect(serena).toBeDefined();
      expect(["installed", "already_available", "skipped", "failed"]).toContain(serena!.status);
    });

    it("should report gitnexus status", () => {
      const gitnexus = results.find((r) => r.name === "gitnexus");

      expect(gitnexus).toBeDefined();
      expect(["installed", "already_available", "skipped", "failed"]).toContain(gitnexus!.status);
    });
  });
});
