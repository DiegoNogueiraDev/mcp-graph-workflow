/**
 * MCP dependencies installer.
 * Detects and installs ecosystem tools (GitNexus, Serena, Context7, Playwright).
 * Never throws — returns InstallResult[] with status for each dependency.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";

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
    await execAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a shell command and return success/failure.
 */
async function runCommand(
  cmd: string,
  args: string[],
  timeoutMs: number = 60000,
): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, args, { timeout: timeoutMs });
    return { ok: true, output: stdout || stderr };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, output: message };
  }
}

async function checkGitNexus(): Promise<InstallResult> {
  const name = "gitnexus";

  const available = await isCommandAvailable("gitnexus");
  if (available) {
    logger.info("GitNexus already available", { name });
    return { name, status: "already_available", message: "gitnexus command found in PATH" };
  }

  // Try to verify via npx
  const npxCheck = await runCommand("npx", ["-y", "gitnexus", "--version"], 30000);
  if (npxCheck.ok) {
    logger.success("GitNexus available via npx", { name });
    return { name, status: "already_available", message: "gitnexus available via npx" };
  }

  logger.warn("GitNexus not available", { name, error: npxCheck.output });
  return { name, status: "failed", message: `gitnexus not available: ${npxCheck.output}` };
}

async function checkSerena(): Promise<InstallResult> {
  const name = "serena";

  // Check if uvx is available
  const uvxAvailable = await isCommandAvailable("uvx");
  if (uvxAvailable) {
    logger.info("uvx already available, Serena can be used", { name });
    return { name, status: "already_available", message: "uvx available — serena can run via uvx" };
  }

  // Check if pip/pip3 is available to install uvx
  const pipCmd = (await isCommandAvailable("pip3")) ? "pip3" : (await isCommandAvailable("pip")) ? "pip" : null;

  if (!pipCmd) {
    logger.warn("Python/pip not available, skipping Serena install", { name });
    return {
      name,
      status: "skipped",
      message: "Python/pip not available. Install Python 3 and run: pip install uvx",
    };
  }

  // Try to install uvx via pip
  logger.info("Installing uvx via pip", { name, pip: pipCmd });
  const uvxInstall = await runCommand(pipCmd, ["install", "uvx"], 120000);
  if (!uvxInstall.ok) {
    logger.warn("Failed to install uvx", { name, error: uvxInstall.output });
    return { name, status: "failed", message: `Failed to install uvx: ${uvxInstall.output}` };
  }

  logger.success("uvx installed, Serena ready", { name });
  return { name, status: "installed", message: "uvx installed via pip — serena ready" };
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
    checkGitNexus(),
    checkSerena(),
    checkContext7(),
    checkPlaywright(),
  ]);

  const summary = results.map((r) => `${r.name}: ${r.status}`).join(", ");
  logger.info("MCP dependencies check complete", { summary });

  return results;
}
