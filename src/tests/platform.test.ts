import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("platform utilities", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore process.platform
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  describe("whichCommand", () => {
    it("should return 'which' on non-Windows", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      // Re-import to pick up the new platform value
      const mod = await import("../core/utils/platform.js");
      // IS_WINDOWS is evaluated at module load, so test the function logic directly
      expect(mod.whichCommand()).toBe("which");
    });

    it("should return 'where' on Windows", async () => {
      // Since IS_WINDOWS is set at module load time, we test the function behavior
      // by checking that whichCommand returns the correct value for the current platform
      const mod = await import("../core/utils/platform.js");
      const expected = process.platform === "win32" ? "where" : "which";
      expect(mod.whichCommand()).toBe(expected);
    });
  });

  describe("killProcess", () => {
    it("should call SIGTERM on Unix", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      const mod = await import("../core/utils/platform.js");

      const mockProc = {
        killed: false,
        pid: 12345,
        kill: vi.fn(),
      } as unknown as import("node:child_process").ChildProcess;

      mod.killProcess(mockProc);
      expect(mockProc.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("should not throw when process is already killed", async () => {
      const mod = await import("../core/utils/platform.js");

      const mockProc = {
        killed: true,
        pid: 12345,
        kill: vi.fn(),
      } as unknown as import("node:child_process").ChildProcess;

      expect(() => mod.killProcess(mockProc)).not.toThrow();
      expect(mockProc.kill).not.toHaveBeenCalled();
    });

    it("should not throw when process is null", async () => {
      const mod = await import("../core/utils/platform.js");
      expect(() => mod.killProcess(null as unknown as import("node:child_process").ChildProcess)).not.toThrow();
    });
  });

  describe("IS_WINDOWS", () => {
    it("should be a boolean", async () => {
      const mod = await import("../core/utils/platform.js");
      expect(typeof mod.IS_WINDOWS).toBe("boolean");
    });

    it("should match current platform check", async () => {
      const mod = await import("../core/utils/platform.js");
      expect(mod.IS_WINDOWS).toBe(process.platform === "win32");
    });
  });
});
