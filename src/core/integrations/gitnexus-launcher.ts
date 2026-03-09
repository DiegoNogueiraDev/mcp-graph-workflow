/**
 * GitNexus lifecycle manager.
 * Handles analyze, serve (as child process), and cleanup.
 * All operations are local-only — no data sent externally.
 */

import { existsSync } from "node:fs";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { logger } from "../utils/logger.js";

const execAsync = promisify(execFile);

const GITNEXUS_DIR = ".gitnexus";

let serveProcess: ChildProcess | null = null;

export interface AnalyzeResult {
  skipped: boolean;
  success?: boolean;
  reason: string;
}

export interface ServeResult {
  started: boolean;
  message: string;
  port?: number;
}

/**
 * Check if the codebase has been indexed by GitNexus.
 */
export function isGitNexusIndexed(basePath: string): boolean {
  return existsSync(path.join(basePath, GITNEXUS_DIR));
}

/**
 * Check if GitNexus serve is running on a given port via HTTP probe.
 */
export async function isGitNexusRunning(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://localhost:${port}`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Ensure codebase is analyzed by GitNexus.
 * Skips if `.gitnexus/` already exists.
 */
export async function ensureGitNexusAnalyzed(basePath: string): Promise<AnalyzeResult> {
  if (isGitNexusIndexed(basePath)) {
    logger.info("GitNexus index already exists, skipping analysis", { basePath });
    return { skipped: true, reason: "Already indexed" };
  }

  logger.info("Running GitNexus analyze", { basePath });

  try {
    await execAsync("npx", ["-y", "gitnexus", "analyze", basePath], {
      timeout: 300_000, // 5 min max for large codebases
      cwd: basePath,
    });

    logger.success("GitNexus analysis complete", { basePath });
    return { skipped: false, success: true, reason: "Analysis completed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("GitNexus analysis failed", { basePath, error: message });
    return { skipped: false, success: false, reason: `Analysis failed: ${message}` };
  }
}

/**
 * Start GitNexus serve as a child process on the given port.
 * Returns immediately after spawning — does not wait for readiness.
 */
export async function startGitNexusServe(basePath: string, port: number): Promise<ServeResult> {
  // Don't serve if not indexed
  if (!isGitNexusIndexed(basePath)) {
    logger.info("GitNexus not indexed, skipping serve", { basePath });
    return { started: false, message: "Codebase not indexed. Run gitnexus analyze first." };
  }

  // Don't start if already running
  const alreadyRunning = await isGitNexusRunning(port);
  if (alreadyRunning) {
    logger.info("GitNexus already running", { port });
    return { started: true, message: `GitNexus already running on port ${port}`, port };
  }

  // Don't start if we already spawned a process
  if (serveProcess && !serveProcess.killed) {
    logger.info("GitNexus serve process already spawned", { pid: serveProcess.pid });
    return { started: true, message: "GitNexus serve process already active", port };
  }

  try {
    serveProcess = spawn("npx", ["-y", "gitnexus", "serve", "--port", String(port)], {
      cwd: basePath,
      stdio: "pipe",
      detached: false,
    });

    serveProcess.on("error", (err) => {
      logger.error("GitNexus serve process error", { error: err.message });
      serveProcess = null;
    });

    serveProcess.on("exit", (code) => {
      logger.info("GitNexus serve process exited", { code });
      serveProcess = null;
    });

    logger.success("GitNexus serve started", { port, pid: serveProcess.pid });
    return { started: true, message: `GitNexus serve started on port ${port}`, port };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to start GitNexus serve", { error: message });
    return { started: false, message: `Failed to start: ${message}` };
  }
}

/**
 * Stop the GitNexus serve child process if running.
 */
export async function stopGitNexus(): Promise<void> {
  if (!serveProcess || serveProcess.killed) {
    serveProcess = null;
    return;
  }

  logger.info("Stopping GitNexus serve", { pid: serveProcess.pid });

  try {
    serveProcess.kill("SIGTERM");
  } catch {
    // Process may have already exited
  }

  serveProcess = null;
}
