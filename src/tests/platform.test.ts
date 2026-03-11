import { describe, it, expect, vi, afterEach } from "vitest";

describe("platform utilities", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  describe("whichCommand", () => {
    it("should return 'which' on non-Windows", async () => {
      vi.resetModules();
      Object.defineProperty(process, "platform", { value: "darwin" });
      const mod = await import("../core/utils/platform.js");
      expect(mod.whichCommand()).toBe("which");
    });

    it("should return 'where' on Windows", async () => {
      vi.resetModules();
      Object.defineProperty(process, "platform", { value: "win32" });
      const mod = await import("../core/utils/platform.js");
      expect(mod.whichCommand()).toBe("where");
    });
  });

  describe("killProcess", () => {
    it("should call SIGTERM on Unix", async () => {
      vi.resetModules();
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
      vi.resetModules();
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
      vi.resetModules();
      const mod = await import("../core/utils/platform.js");
      expect(() => mod.killProcess(null as unknown as import("node:child_process").ChildProcess)).not.toThrow();
    });
  });

  describe("IS_WINDOWS", () => {
    it("should be a boolean", async () => {
      vi.resetModules();
      const mod = await import("../core/utils/platform.js");
      expect(typeof mod.IS_WINDOWS).toBe("boolean");
    });

    it("should be true on Windows", async () => {
      vi.resetModules();
      Object.defineProperty(process, "platform", { value: "win32" });
      const mod = await import("../core/utils/platform.js");
      expect(mod.IS_WINDOWS).toBe(true);
    });

    it("should be false on non-Windows", async () => {
      vi.resetModules();
      Object.defineProperty(process, "platform", { value: "darwin" });
      const mod = await import("../core/utils/platform.js");
      expect(mod.IS_WINDOWS).toBe(false);
    });
  });
});
