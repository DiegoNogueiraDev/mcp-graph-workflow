import { describe, it, expect } from "vitest";

import { whichCommand, killProcess, IS_WINDOWS } from "../core/utils/platform.js";

describe("cross-platform utilities (runtime OS)", () => {
  describe("whichCommand", () => {
    it("should return the correct command for the current OS", () => {
      const cmd = whichCommand();
      if (process.platform === "win32") {
        expect(cmd).toBe("where");
      } else {
        expect(cmd).toBe("which");
      }
    });

    it("should return a non-empty string", () => {
      expect(whichCommand().length).toBeGreaterThan(0);
    });
  });

  describe("IS_WINDOWS", () => {
    it("should match process.platform", () => {
      expect(IS_WINDOWS).toBe(process.platform === "win32");
    });
  });

  describe("killProcess", () => {
    it("should not throw for null input", () => {
      expect(() => killProcess(null as unknown as import("node:child_process").ChildProcess)).not.toThrow();
    });

    it("should not throw for already-killed process", () => {
      const mockProc = { killed: true, pid: 1 } as unknown as import("node:child_process").ChildProcess;
      expect(() => killProcess(mockProc)).not.toThrow();
    });

    it("should handle process without pid gracefully on Windows scenario", () => {
      // On non-Windows this exercises the SIGTERM path
      const killFn = (): void => { /* no-op */ };
      const mockProc = {
        killed: false,
        pid: undefined,
        kill: killFn,
      } as unknown as import("node:child_process").ChildProcess;

      // Should not throw regardless of platform
      expect(() => killProcess(mockProc)).not.toThrow();
    });
  });
});
