import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import { whichCommand } from "../utils/platform.js";

export interface ToolInfo {
  installed: boolean;
  running: boolean;
  url?: string;
  details?: Record<string, unknown>;
}

export interface IntegrationsStatus {
  codeGraph: ToolInfo & { symbolCount: number };
  memories: { available: boolean; count: number; directory: string; names: string[] };
  playwright: ToolInfo;
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
 * Read memory file names from workflow-graph/memories/ directory.
 */
async function readMemoryNames(basePath: string): Promise<string[]> {
  try {
    const { listMemories } = await import("../memory/memory-reader.js");
    return await listMemories(basePath);
  } catch (err) {
    logger.debug("memories:list:fail", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Check code graph index status from SQLite.
 */
function getCodeGraphStatus(basePath: string): { indexed: boolean; symbolCount: number } {
  try {
    const dbPath = path.join(basePath, "workflow-graph", "graph.db");
    if (!existsSync(dbPath)) return { indexed: false, symbolCount: 0 };

    const db = new Database(dbPath, { readonly: true });
    try {
      const row = db.prepare("SELECT symbol_count FROM code_index_meta LIMIT 1").get() as { symbol_count: number } | undefined;
      return { indexed: !!row, symbolCount: row?.symbol_count ?? 0 };
    } catch {
      return { indexed: false, symbolCount: 0 };
    } finally {
      db.close();
    }
  } catch {
    return { indexed: false, symbolCount: 0 };
  }
}

/**
 * Detect status of all ecosystem tools.
 */
export async function getIntegrationsStatus(basePath: string): Promise<IntegrationsStatus> {
  logger.info("Checking integrations status", { basePath });

  const [memoryNames, playwrightInstalled] =
    await Promise.all([
      readMemoryNames(basePath),
      isCommandInstalled("npx").then(() => true).catch(() => false),
    ]);

  const codeGraphInfo = getCodeGraphStatus(basePath);

  return {
    codeGraph: {
      installed: true, // Native — always available
      running: codeGraphInfo.indexed,
      symbolCount: codeGraphInfo.symbolCount,
    },
    memories: {
      available: memoryNames.length > 0,
      count: memoryNames.length,
      directory: "workflow-graph/memories",
      names: memoryNames,
    },
    playwright: {
      installed: playwrightInstalled,
      running: false,
    },
  };
}
