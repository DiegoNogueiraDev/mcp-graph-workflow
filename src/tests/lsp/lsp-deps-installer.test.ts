/**
 * TDD tests for LSP language server dependency installer.
 * Tests detection, npm-install recommendations, and system-install instructions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkLspDep,
  installLspDeps,
  LSP_NPM_PACKAGES,
  LSP_SYSTEM_PACKAGES,
} from "../../core/lsp/lsp-deps-installer.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:util")>();
  return {
    ...original,
    promisify: (fn: unknown) => fn,
  };
});

describe("lsp-deps-installer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LSP_NPM_PACKAGES", () => {
    it("should include typescript-language-server", () => {
      expect(LSP_NPM_PACKAGES).toHaveProperty("typescript");
      expect(LSP_NPM_PACKAGES.typescript).toBe("typescript-language-server");
    });

    it("should include intelephense for PHP", () => {
      expect(LSP_NPM_PACKAGES).toHaveProperty("php");
      expect(LSP_NPM_PACKAGES.php).toBe("intelephense");
    });
  });

  describe("LSP_SYSTEM_PACKAGES", () => {
    it("should include install instructions for python", () => {
      expect(LSP_SYSTEM_PACKAGES).toHaveProperty("python");
      expect(LSP_SYSTEM_PACKAGES.python.installHint).toContain("pip");
    });

    it("should include install instructions for rust", () => {
      expect(LSP_SYSTEM_PACKAGES).toHaveProperty("rust");
      expect(LSP_SYSTEM_PACKAGES.rust.installHint).toContain("rustup");
    });

    it("should include install instructions for go", () => {
      expect(LSP_SYSTEM_PACKAGES).toHaveProperty("go");
      expect(LSP_SYSTEM_PACKAGES.go.installHint).toContain("go install");
    });
  });

  describe("checkLspDep", () => {
    it("should return already_available when server is in PATH", async () => {
      const { execFile } = await import("node:child_process");
      (execFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ stdout: "/usr/bin/typescript-language-server" });

      const result = await checkLspDep("typescript", "typescript-language-server");

      expect(result.status).toBe("already_available");
      expect(result.name).toBe("typescript-language-server");
    });

    it("should return not_found when server is not available", async () => {
      const { execFile } = await import("node:child_process");
      (execFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("not found"));

      const result = await checkLspDep("typescript", "typescript-language-server");

      expect(result.status).toBe("not_found");
    });
  });

  describe("installLspDeps", () => {
    it("should return results for each detected language", async () => {
      const { execFile } = await import("node:child_process");
      // All commands not found
      (execFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));

      const results = await installLspDeps(["typescript", "python"]);

      expect(results).toHaveLength(2);
      expect(results.find((r) => r.name === "typescript-language-server")).toBeDefined();
      expect(results.find((r) => r.name === "pylsp")).toBeDefined();
    });

    it("should return empty array for empty language list", async () => {
      const results = await installLspDeps([]);
      expect(results).toEqual([]);
    });

    it("should skip unknown languages", async () => {
      const results = await installLspDeps(["unknown_lang"]);
      expect(results).toHaveLength(0);
    });

    it("should include installHint for system packages", async () => {
      const { execFile } = await import("node:child_process");
      (execFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));

      const results = await installLspDeps(["python"]);

      expect(results[0].message).toContain("pip");
    });

    it("should include npmPackage for npm-installable servers", async () => {
      const { execFile } = await import("node:child_process");
      (execFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));

      const results = await installLspDeps(["typescript"]);

      expect(results[0].message).toContain("npm");
    });
  });
});
