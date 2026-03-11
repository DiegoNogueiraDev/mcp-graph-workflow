import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { logger } from "../core/utils/logger.js";
import { buildMcpServersConfig } from "../core/integrations/mcp-servers-config.js";
import { installAllMcpDeps } from "../core/integrations/mcp-deps-installer.js";
import { generateClaudeMdSection, generateCopilotInstructions, applySection } from "../core/config/ai-memory-generator.js";

import { STORE_DIR } from "../core/utils/constants.js";

const MCP_CONFIG_FILE = ".mcp.json";
const GITIGNORE_ENTRY = "workflow-graph/";

function resolveCommand(): string {
  // Check if running via npx/global — use package name
  // Check if running from node_modules — use relative path
  const binPath = process.argv[1];
  if (binPath && binPath.includes("node_modules")) {
    return "npx";
  }
  return "npx";
}

function resolveArgs(): string[] {
  const binPath = process.argv[1];
  if (binPath && binPath.includes("node_modules")) {
    return ["-y", "@mcp-graph-workflow/mcp-graph"];
  }
  return ["-y", "mcp-graph"];
}

function writeMcpJson(projectDir: string): void {
  const mcpConfigPath = path.join(projectDir, MCP_CONFIG_FILE);

  let existing: Record<string, unknown> = {};
  if (existsSync(mcpConfigPath)) {
    try {
      existing = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));
    } catch {
      // corrupted file, overwrite
    }
  }

  const config = buildMcpServersConfig(existing as Partial<{ mcpServers: Record<string, { command: string; args: string[] }> }>);
  writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  logger.info(`${MCP_CONFIG_FILE} configured with all MCP servers`, { path: mcpConfigPath });
}

function writeVscodeMcpJson(projectDir: string): void {
  const vscodeDir = path.join(projectDir, ".vscode");
  mkdirSync(vscodeDir, { recursive: true });
  const vscodeMcpPath = path.join(vscodeDir, "mcp.json");

  let existing: Record<string, unknown> = {};
  if (existsSync(vscodeMcpPath)) {
    try {
      existing = JSON.parse(readFileSync(vscodeMcpPath, "utf-8"));
    } catch {
      // corrupted file, overwrite
    }
  }

  // Use buildMcpServersConfig to get all 5 MCPs, then convert to VS Code format
  const mcpConfig = buildMcpServersConfig();
  const servers = (existing.servers ?? {}) as Record<string, unknown>;
  for (const [name, entry] of Object.entries(mcpConfig.mcpServers)) {
    servers[name] = { type: "stdio", command: entry.command, args: entry.args };
  }

  const config = { ...existing, servers };
  writeFileSync(vscodeMcpPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  logger.info(".vscode/mcp.json configured with all MCP servers", { path: vscodeMcpPath });
}

function ensureGitignore(projectDir: string): void {
  const gitignorePath = path.join(projectDir, ".gitignore");

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, GITIGNORE_ENTRY + "\n", "utf-8");
    logger.info(".gitignore created", { entry: GITIGNORE_ENTRY });
    return;
  }

  const content = readFileSync(gitignorePath, "utf-8");
  if (content.includes(GITIGNORE_ENTRY)) {
    logger.debug(".gitignore already has entry", { entry: GITIGNORE_ENTRY });
    return;
  }

  const separator = content.endsWith("\n") ? "" : "\n";
  writeFileSync(gitignorePath, content + separator + GITIGNORE_ENTRY + "\n", "utf-8");
  logger.info(".gitignore updated", { entry: GITIGNORE_ENTRY });
}

function initStore(projectDir: string): void {
  const storeDir = path.join(projectDir, STORE_DIR);
  mkdirSync(storeDir, { recursive: true });

  const store = SqliteStore.open(projectDir);
  const projectName = path.basename(projectDir);
  store.initProject(projectName);
  store.close();

  logger.info("Database initialized", { dir: STORE_DIR });
}

function generateAndWriteClaudeMd(projectDir: string): void {
  const projectName = path.basename(projectDir);
  const claudeMdPath = path.join(projectDir, "CLAUDE.md");
  const section = generateClaudeMdSection(projectName);

  let existing = "";
  if (existsSync(claudeMdPath)) {
    existing = readFileSync(claudeMdPath, "utf-8");
  }

  const result = applySection(existing, section);
  writeFileSync(claudeMdPath, result, "utf-8");
  logger.info("CLAUDE.md updated with mcp-graph instructions", { path: claudeMdPath });
}

function generateAndWriteCopilotInstructions(projectDir: string): void {
  const projectName = path.basename(projectDir);
  const githubDir = path.join(projectDir, ".github");
  mkdirSync(githubDir, { recursive: true });
  const copilotPath = path.join(githubDir, "copilot-instructions.md");
  const section = generateCopilotInstructions(projectName);

  let existing = "";
  if (existsSync(copilotPath)) {
    existing = readFileSync(copilotPath, "utf-8");
  }

  const result = applySection(existing, section);
  writeFileSync(copilotPath, result, "utf-8");
  logger.info("copilot-instructions.md updated", { path: copilotPath });
}

export async function runInit(projectDir: string): Promise<void> {
  logger.info("mcp-graph init", { dir: projectDir });

  initStore(projectDir);
  writeMcpJson(projectDir);
  writeVscodeMcpJson(projectDir);
  ensureGitignore(projectDir);

  // Install/verify MCP ecosystem dependencies
  const depResults = await installAllMcpDeps(projectDir);
  const installed = depResults.filter((r) => r.status === "installed" || r.status === "already_available");
  const failed = depResults.filter((r) => r.status === "failed" || r.status === "skipped");

  if (installed.length > 0) {
    logger.success("MCP dependencies ready", {
      ready: installed.map((r) => r.name).join(", "),
    });
  }
  if (failed.length > 0) {
    logger.warn("Some MCP dependencies unavailable", {
      unavailable: failed.map((r) => `${r.name}: ${r.message}`).join("; "),
    });
  }

  // Generate AI instruction files (idempotent)
  generateAndWriteClaudeMd(projectDir);
  generateAndWriteCopilotInstructions(projectDir);

  logger.success("mcp-graph initialized", {
    dir: projectDir,
    store: STORE_DIR,
  });
}
