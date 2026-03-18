/**
 * MCP dependencies installer.
 * Detects ecosystem tools (Context7, Playwright).
 * Never throws — returns InstallResult[] with status for each dependency.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";
import { whichCommand } from "../utils/platform.js";

const execAsync = promisify(execFile);

export type InstallStatus = "installed" | "already_available" | "skipped" | "failed";

export interface InstallResult {
  name: string;
  status: InstallStatus;
  message: string;
}

/**
 * Check if a command-line tool is available in PATH.
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await execAsync(whichCommand(), [command]);
    return true;
  } catch {
    return false;
  }
}

async function checkContext7(): Promise<InstallResult> {
  const name = "context7";

  const npxAvailable = await isCommandAvailable("npx");
  if (npxAvailable) {
    logger.info("Context7 available via npx", { name });
    return { name, status: "already_available", message: "npx available — context7 runs via npx -y @upstash/context7-mcp" };
  }

  return { name, status: "skipped", message: "npx not available" };
}

async function checkPlaywright(): Promise<InstallResult> {
  const name = "playwright";

  const npxAvailable = await isCommandAvailable("npx");
  if (npxAvailable) {
    logger.info("Playwright MCP available via npx", { name });
    return { name, status: "already_available", message: "npx available — playwright runs via npx @playwright/mcp@latest" };
  }

  return { name, status: "skipped", message: "npx not available" };
}

/**
 * Install/verify all MCP ecosystem dependencies.
 * Never throws — returns status for each dependency.
 */
export async function installAllMcpDeps(_basePath: string): Promise<InstallResult[]> {
  logger.info("Checking MCP ecosystem dependencies");

  const results = await Promise.all([
    checkContext7(),
    checkPlaywright(),
  ]);

  const summary = results.map((r) => `${r.name}: ${r.status}`).join(", ");
  logger.info("MCP dependencies check complete", { summary });

  return results;
}
