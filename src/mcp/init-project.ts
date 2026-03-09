import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { logger } from "../core/utils/logger.js";

const MCP_CONFIG_FILE = ".mcp.json";
const STORE_DIR = ".mcp-graph";
const GITIGNORE_ENTRY = ".mcp-graph/";

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
    return ["-y", "@diegonogueiradev_/mcp-graph"];
  }
  return ["-y", "mcp-graph"];
}

function writeMcpJson(projectDir: string): void {
  const mcpConfigPath = path.join(projectDir, MCP_CONFIG_FILE);
  const command = resolveCommand();
  const args = resolveArgs();

  let existing: Record<string, unknown> = {};
  if (existsSync(mcpConfigPath)) {
    try {
      existing = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));
    } catch {
      // corrupted file, overwrite
    }
  }

  const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  servers["mcp-graph"] = { command, args };

  const config = { ...existing, mcpServers: servers };
  writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  logger.info(`${MCP_CONFIG_FILE} configured`, { path: mcpConfigPath });
}

function writeVscodeMcpJson(projectDir: string): void {
  const vscodeDir = path.join(projectDir, ".vscode");
  mkdirSync(vscodeDir, { recursive: true });
  const vscodeMcpPath = path.join(vscodeDir, "mcp.json");

  const command = resolveCommand();
  const args = resolveArgs();

  let existing: Record<string, unknown> = {};
  if (existsSync(vscodeMcpPath)) {
    try {
      existing = JSON.parse(readFileSync(vscodeMcpPath, "utf-8"));
    } catch {
      // corrupted file, overwrite
    }
  }

  const servers = (existing.servers ?? {}) as Record<string, unknown>;
  servers["mcp-graph"] = { type: "stdio", command, args };

  const config = { ...existing, servers };
  writeFileSync(vscodeMcpPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  logger.info(".vscode/mcp.json configured", { path: vscodeMcpPath });
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

export async function runInit(projectDir: string): Promise<void> {
  logger.info("mcp-graph init", { dir: projectDir });

  initStore(projectDir);
  writeMcpJson(projectDir);
  writeVscodeMcpJson(projectDir);
  ensureGitignore(projectDir);

  logger.success("mcp-graph initialized", {
    dir: projectDir,
    store: STORE_DIR,
  });
}
