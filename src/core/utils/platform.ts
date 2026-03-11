/**
 * Cross-platform utilities.
 * Abstracts OS-specific operations (command lookup, process killing)
 * so the rest of the codebase stays platform-agnostic.
 */

import { execFileSync, type ChildProcess } from "node:child_process";
import { logger } from "./logger.js";

export const IS_WINDOWS: boolean = process.platform === "win32";

/**
 * Return the OS-appropriate command for locating executables in PATH.
 * "where" on Windows, "which" on Unix/macOS.
 */
export function whichCommand(): string {
  return IS_WINDOWS ? "where" : "which";
}

/**
 * Kill a child process in a cross-platform manner.
 * Uses taskkill on Windows (SIGTERM is not supported), SIGTERM on Unix.
 */
export function killProcess(proc: ChildProcess): void {
  if (!proc || proc.killed) return;

  if (IS_WINDOWS) {
    // Windows does not support SIGTERM reliably; use taskkill
    if (proc.pid != null) {
      try {
        execFileSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"]);
      } catch {
        logger.debug("taskkill failed, process may have already exited", { pid: proc.pid });
      }
    }
  } else {
    try {
      proc.kill("SIGTERM");
    } catch {
      // Process may have already exited
    }
  }
}
