import { logger } from "../utils/logger.js";
import { whichCommand } from "../utils/platform.js";

export interface ToolInfo {
  installed: boolean;
  running: boolean;
  url?: string;
  details?: Record<string, unknown>;
}

export interface IntegrationsStatus {
  gitnexus: ToolInfo;
  serena: ToolInfo & { memories: string[] };
  playwright: ToolInfo;
}

/**
 * Detect whether a local HTTP service is running by attempting a fetch.
 */
async function probeHttp(url: string, timeoutMs: number = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status < 500;
  } catch (err) {
    logger.debug("probe:http:fail", { url, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/**
 * Check if a command-line tool is installed by looking for it in PATH.
 */
async function isCommandInstalled(command: string): Promise<boolean> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    await exec(whichCommand(), [command]);
    return true;
  } catch (err) {
    logger.debug("probe:command:fail", { command, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/**
 * Read Serena memory file names from .serena/memories/ directory.
 */
async function readSerenaMemories(basePath: string): Promise<string[]> {
  try {
    const path = await import("node:path");
    const { readdir } = await import("node:fs/promises");
    const memoriesDir = path.join(basePath, ".serena", "memories");
    const files = await readdir(memoriesDir);
    return files.filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
  } catch (err) {
    logger.debug("serena:memories:fail", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Check if Serena is configured for this project.
 */
async function isSerenaConfigured(basePath: string): Promise<boolean> {
  try {
    const path = await import("node:path");
    const { access } = await import("node:fs/promises");
    await access(path.join(basePath, ".serena"));
    return true;
  } catch (err) {
    logger.debug("serena:config:fail", { basePath, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/**
 * Detect status of all ecosystem tools.
 */
export async function getIntegrationsStatus(basePath: string): Promise<IntegrationsStatus> {
  logger.info("Checking integrations status", { basePath });

  const GITNEXUS_PORT = parseInt(process.env.GITNEXUS_PORT || "3737", 10);
  const gitnexusUrl = `http://localhost:${GITNEXUS_PORT}`;

  const [gitnexusInstalled, gitnexusRunning, serenaConfigured, serenaMemories, playwrightInstalled] =
    await Promise.all([
      isCommandInstalled("gitnexus"),
      probeHttp(gitnexusUrl),
      isSerenaConfigured(basePath),
      readSerenaMemories(basePath),
      isCommandInstalled("npx").then(() => true).catch(() => false),
    ]);

  return {
    gitnexus: {
      installed: gitnexusInstalled,
      running: gitnexusRunning,
      ...(gitnexusRunning ? { url: gitnexusUrl } : {}),
    },
    serena: {
      installed: serenaConfigured,
      running: serenaConfigured,
      memories: serenaMemories,
    },
    playwright: {
      installed: playwrightInstalled,
      running: false,
    },
  };
}
