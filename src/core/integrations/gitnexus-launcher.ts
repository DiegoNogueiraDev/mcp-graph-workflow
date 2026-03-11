/**
 * GitNexus lifecycle manager.
 * Handles analyze, serve (as child process), and cleanup.
 * All operations are local-only — no data sent externally.
 *
 * Binary resolution order:
 *   1. Local node_modules/.bin/gitnexus (target project)
 *   2. Local node_modules/.bin/gitnexus (mcp-graph install dir)
 *   3. Global `gitnexus` on PATH
 *   4. Auto-install via `npm install --no-save gitnexus` in target project, then use local bin
 */

import { existsSync } from "node:fs";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../utils/logger.js";

const execAsync = promisify(execFile);

const GITNEXUS_DIR = ".gitnexus";
const GITNEXUS_PKG = "gitnexus";

let serveProcess: ChildProcess | null = null;
let resolvedBin: string | null = null;

export type AnalyzePhase = "idle" | "analyzing" | "ready" | "unavailable" | "error";

let analyzePhase: AnalyzePhase = "idle";

/**
 * Get the current analyze phase.
 */
export function getAnalyzePhase(): AnalyzePhase {
  return analyzePhase;
}

/**
 * Reset analyze phase to idle (for testing).
 */
export function resetAnalyzePhase(): void {
  analyzePhase = "idle";
  resolvedBin = null;
}

/**
 * Check if the given path is inside a git repository.
 */
export function isGitRepo(basePath: string): boolean {
  return existsSync(path.join(basePath, ".git"));
}

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

// ── Binary resolution ─────────────────────────────────────

const IS_WINDOWS = process.platform === "win32";

function localBin(dir: string): string {
  const binName = IS_WINDOWS ? `${GITNEXUS_PKG}.cmd` : GITNEXUS_PKG;
  return path.join(dir, "node_modules", ".bin", binName);
}

function mcpGraphRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // src/core/integrations/gitnexus-launcher.ts → project root (3 levels up)
  return path.resolve(path.dirname(thisFile), "..", "..", "..");
}

async function whichGitNexus(): Promise<string | null> {
  const cmd = IS_WINDOWS ? "where" : "which";
  try {
    const { stdout } = await execAsync(cmd, [GITNEXUS_PKG]);
    const bin = stdout.trim().split(/\r?\n/)[0];
    return bin.length > 0 ? bin : null;
  } catch {
    return null;
  }
}

async function installGitNexus(basePath: string): Promise<boolean> {
  logger.info("Auto-installing gitnexus in target project", { basePath });
  try {
    await execAsync("npm", ["install", "--no-save", GITNEXUS_PKG], {
      cwd: basePath,
      timeout: 120_000,
    });
    logger.success("gitnexus installed successfully", { basePath });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("Failed to auto-install gitnexus", { error: msg });
    return false;
  }
}

/**
 * Resolve the gitnexus binary path.
 * Caches result after first successful resolution.
 */
export async function resolveGitNexusBin(basePath: string): Promise<string | null> {
  if (resolvedBin && existsSync(resolvedBin)) return resolvedBin;

  // 1. Local bin in target project
  const targetBin = localBin(basePath);
  if (existsSync(targetBin)) {
    resolvedBin = targetBin;
    logger.debug("GitNexus resolved: target project local bin", { bin: targetBin });
    return resolvedBin;
  }

  // 2. Local bin in mcp-graph install directory
  const mcpBin = localBin(mcpGraphRoot());
  if (existsSync(mcpBin)) {
    resolvedBin = mcpBin;
    logger.debug("GitNexus resolved: mcp-graph local bin", { bin: mcpBin });
    return resolvedBin;
  }

  // 3. Global binary on PATH
  const globalBin = await whichGitNexus();
  if (globalBin) {
    resolvedBin = globalBin;
    logger.debug("GitNexus resolved: global binary", { bin: globalBin });
    return resolvedBin;
  }

  // 4. Auto-install in target project
  const installed = await installGitNexus(basePath);
  if (installed && existsSync(targetBin)) {
    resolvedBin = targetBin;
    logger.debug("GitNexus resolved: auto-installed local bin", { bin: targetBin });
    return resolvedBin;
  }

  logger.warn("GitNexus binary not found and auto-install failed");
  return null;
}

// ── Core operations ─────────────────────────────────────

/**
 * Ensure codebase is analyzed by GitNexus.
 * Skips if `.gitnexus/` already exists.
 */
export async function ensureGitNexusAnalyzed(basePath: string): Promise<AnalyzeResult> {
  if (!isGitRepo(basePath)) {
    analyzePhase = "unavailable";
    logger.info("No git repository found, skipping GitNexus analysis", { basePath });
    return { skipped: true, reason: "No git repository found" };
  }

  if (isGitNexusIndexed(basePath)) {
    analyzePhase = "ready";
    logger.info("GitNexus index already exists, skipping analysis", { basePath });
    return { skipped: true, reason: "Already indexed" };
  }

  const bin = await resolveGitNexusBin(basePath);
  if (!bin) {
    analyzePhase = "error";
    return {
      skipped: false,
      success: false,
      reason: "GitNexus binary not found. Install with: npm install gitnexus",
    };
  }

  analyzePhase = "analyzing";
  logger.info("Running GitNexus analyze", { basePath, bin });

  try {
    await execAsync(bin, ["analyze", basePath], {
      timeout: 300_000,
      cwd: basePath,
    });

    analyzePhase = "ready";
    logger.success("GitNexus analysis complete", { basePath });
    return { skipped: false, success: true, reason: "Analysis completed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    analyzePhase = "error";
    logger.warn("GitNexus analysis failed", { basePath, error: message });
    return { skipped: false, success: false, reason: `Analysis failed: ${message}` };
  }
}

/**
 * Start GitNexus serve as a child process on the given port.
 * Returns immediately after spawning — does not wait for readiness.
 */
export async function startGitNexusServe(basePath: string, port: number): Promise<ServeResult> {
  if (!isGitNexusIndexed(basePath)) {
    logger.info("GitNexus not indexed, skipping serve", { basePath });
    return { started: false, message: "Codebase not indexed. Run gitnexus analyze first." };
  }

  const alreadyRunning = await isGitNexusRunning(port);
  if (alreadyRunning) {
    logger.info("GitNexus already running", { port });
    return { started: true, message: `GitNexus already running on port ${port}`, port };
  }

  if (serveProcess && !serveProcess.killed) {
    logger.info("GitNexus serve process already spawned", { pid: serveProcess.pid });
    return { started: true, message: "GitNexus serve process already active", port };
  }

  const bin = await resolveGitNexusBin(basePath);
  if (!bin) {
    return { started: false, message: "GitNexus binary not found. Install with: npm install gitnexus" };
  }

  try {
    serveProcess = spawn(bin, ["serve", "--port", String(port)], {
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
