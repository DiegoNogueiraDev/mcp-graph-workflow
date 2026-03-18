import { describe, it, expect, vi, afterEach } from "vitest";
import type { ChildProcess } from "node:child_process";

describe("platform utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should export IS_WINDOWS as a boolean", async () => {
    const { IS_WINDOWS } = await import("../core/utils/platform.js");

    expect(typeof IS_WINDOWS).toBe("boolean");
  });

  it("should return 'which' on non-Windows platforms", async () => {
    const { whichCommand, IS_WINDOWS } = await import("../core/utils/platform.js");

    const result = whichCommand();
    if (IS_WINDOWS) {
      expect(result).toBe("where");
    } else {
      expect(result).toBe("which");
    }
  });

  it("should handle killProcess with a null/undefined proc gracefully", async () => {
    const { killProcess } = await import("../core/utils/platform.js");

    // Should not throw when proc is falsy
    killProcess(null as unknown as ChildProcess);
    killProcess(undefined as unknown as ChildProcess);
  });

  it("should handle killProcess with an already-killed process", async () => {
    const { killProcess } = await import("../core/utils/platform.js");

    const mockProc = {
      killed: true,
      pid: 12345,
      kill: vi.fn(),
    } as unknown as ChildProcess;

    // Should bail out early because proc.killed is true
    killProcess(mockProc);
    expect(mockProc.kill).not.toHaveBeenCalled();
  });

  it("should call SIGTERM on Unix for a live process", async () => {
    const { killProcess, IS_WINDOWS } = await import("../core/utils/platform.js");

    if (IS_WINDOWS) {
      // Skip on Windows — tested in the Windows branch
      return;
    }

    const killFn = vi.fn();
    const mockProc = {
      killed: false,
      pid: 99999,
      kill: killFn,
    } as unknown as ChildProcess;

    killProcess(mockProc);
    expect(killFn).toHaveBeenCalledWith("SIGTERM");
  });
});
