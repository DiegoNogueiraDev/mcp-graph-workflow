import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { logger } from "../core/utils/logger.js";
import { GraphNotInitializedError } from "../core/utils/errors.js";
import { buildMcpServersConfig } from "../core/integrations/mcp-servers-config.js";
import { installAllMcpDeps } from "../core/integrations/mcp-deps-installer.js";
import { generateClaudeMdSection, generateCopilotInstructions, applySection } from "../core/config/ai-memory-generator.js";

import { STORE_DIR } from "../core/utils/constants.js";

const MCP_CONFIG_FILE = ".mcp.json";
const GITIGNORE_ENTRY = "workflow-graph/";

// --- Update types ---

export interface UpdateStepResult {
  step: string;
  status: "updated" | "up-to-date" | "created" | "skipped" | "error";
  message: string;
}

export interface UpdateReport {
  steps: UpdateStepResult[];
  hasChanges: boolean;
}

export interface UpdateOptions {
  only?: string[];
  dryRun?: boolean;
}

// --- Internal helpers ---

function _resolveCommand(): string {
  // Check if running via npx/global — use package name
  // Check if running from node_modules — use relative path
  const binPath = process.argv[1];
  if (binPath && binPath.includes("node_modules")) {
    return "npx";
  }
  return "npx";
}

function _resolveArgs(): string[] {
  const binPath = process.argv[1];
  if (binPath && binPath.includes("node_modules")) {
    return ["-y", "@mcp-graph-workflow/mcp-graph"];
  }
  return ["-y", "mcp-graph"];
}

function writeMcpJson(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const mcpConfigPath = path.join(projectDir, MCP_CONFIG_FILE);

  let existing: Record<string, unknown> = {};
  const fileExists = existsSync(mcpConfigPath);
  if (fileExists) {
    try {
      existing = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));
    } catch {
      // corrupted file, overwrite
    }
  }

  const config = buildMcpServersConfig(existing as Partial<{ mcpServers: Record<string, { command: string; args: string[] }> }>);
  const newContent = JSON.stringify(config, null, 2) + "\n";

  if (fileExists) {
    const currentContent = readFileSync(mcpConfigPath, "utf-8");
    if (currentContent === newContent) {
      return { step: "mcp-json", status: "up-to-date", message: ".mcp.json up-to-date" };
    }
  }

  if (!dryRun) {
    writeFileSync(mcpConfigPath, newContent, "utf-8");
    logger.info(`${MCP_CONFIG_FILE} configured with all MCP servers`, { path: mcpConfigPath });
  }

  return {
    step: "mcp-json",
    status: fileExists ? "updated" : "created",
    message: fileExists ? ".mcp.json updated" : ".mcp.json created",
  };
}

function writeVscodeMcpJson(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const vscodeDir = path.join(projectDir, ".vscode");
  const vscodeMcpPath = path.join(vscodeDir, "mcp.json");

  let existing: Record<string, unknown> = {};
  const fileExists = existsSync(vscodeMcpPath);
  if (fileExists) {
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
  const newContent = JSON.stringify(config, null, 2) + "\n";

  if (fileExists) {
    const currentContent = readFileSync(vscodeMcpPath, "utf-8");
    if (currentContent === newContent) {
      return { step: "vscode-mcp", status: "up-to-date", message: ".vscode/mcp.json up-to-date" };
    }
  }

  if (!dryRun) {
    mkdirSync(vscodeDir, { recursive: true });
    writeFileSync(vscodeMcpPath, newContent, "utf-8");
    logger.info(".vscode/mcp.json configured with all MCP servers", { path: vscodeMcpPath });
  }

  return {
    step: "vscode-mcp",
    status: fileExists ? "updated" : "created",
    message: fileExists ? ".vscode/mcp.json updated" : ".vscode/mcp.json created",
  };
}

function ensureGitignore(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const gitignorePath = path.join(projectDir, ".gitignore");

  if (!existsSync(gitignorePath)) {
    if (!dryRun) {
      writeFileSync(gitignorePath, GITIGNORE_ENTRY + "\n", "utf-8");
      logger.info(".gitignore created", { entry: GITIGNORE_ENTRY });
    }
    return { step: "gitignore", status: "created", message: ".gitignore created with workflow-graph/" };
  }

  const content = readFileSync(gitignorePath, "utf-8");
  if (content.includes(GITIGNORE_ENTRY)) {
    return { step: "gitignore", status: "up-to-date", message: ".gitignore up-to-date" };
  }

  if (!dryRun) {
    const separator = content.endsWith("\n") ? "" : "\n";
    writeFileSync(gitignorePath, content + separator + GITIGNORE_ENTRY + "\n", "utf-8");
    logger.info(".gitignore updated", { entry: GITIGNORE_ENTRY });
  }

  return { step: "gitignore", status: "updated", message: ".gitignore updated with workflow-graph/" };
}

function generateAndWriteClaudeMd(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const projectName = path.basename(projectDir);
  const claudeMdPath = path.join(projectDir, "CLAUDE.md");
  const section = generateClaudeMdSection(projectName);

  const fileExists = existsSync(claudeMdPath);
  let existing = "";
  if (fileExists) {
    existing = readFileSync(claudeMdPath, "utf-8");
  }

  const result = applySection(existing, section);

  if (fileExists && existing === result) {
    return { step: "claude-md", status: "up-to-date", message: "CLAUDE.md up-to-date" };
  }

  if (!dryRun) {
    writeFileSync(claudeMdPath, result, "utf-8");
    logger.info("CLAUDE.md updated with mcp-graph instructions", { path: claudeMdPath });
  }

  return {
    step: "claude-md",
    status: fileExists ? "updated" : "created",
    message: fileExists ? "CLAUDE.md updated" : "CLAUDE.md created",
  };
}

function generateAndWriteCopilotInstructions(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const projectName = path.basename(projectDir);
  const githubDir = path.join(projectDir, ".github");
  const copilotPath = path.join(githubDir, "copilot-instructions.md");
  const section = generateCopilotInstructions(projectName);

  const fileExists = existsSync(copilotPath);
  let existing = "";
  if (fileExists) {
    existing = readFileSync(copilotPath, "utf-8");
  }

  const result = applySection(existing, section);

  if (fileExists && existing === result) {
    return { step: "copilot-md", status: "up-to-date", message: "copilot-instructions.md up-to-date" };
  }

  if (!dryRun) {
    mkdirSync(githubDir, { recursive: true });
    writeFileSync(copilotPath, result, "utf-8");
    logger.info("copilot-instructions.md updated", { path: copilotPath });
  }

  return {
    step: "copilot-md",
    status: fileExists ? "updated" : "created",
    message: fileExists ? "copilot-instructions.md updated" : "copilot-instructions.md created",
  };
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

// --- Public API ---

export async function runUpdate(
  projectDir: string,
  options: UpdateOptions = {},
): Promise<UpdateReport> {
  const dbPath = path.join(projectDir, STORE_DIR, "graph.db");

  if (!existsSync(dbPath)) {
    throw new GraphNotInitializedError();
  }

  const steps: UpdateStepResult[] = [];
  const shouldRun = (step: string): boolean =>
    !options.only || options.only.includes(step);

  // 1. DB migrations
  if (shouldRun("db")) {
    const store = SqliteStore.open(projectDir);
    store.close();
    steps.push({ step: "db", status: "up-to-date", message: "Database migrations applied" });
  }

  // 2. Config files
  if (shouldRun("mcp-json")) steps.push(writeMcpJson(projectDir, options.dryRun));
  if (shouldRun("vscode-mcp")) steps.push(writeVscodeMcpJson(projectDir, options.dryRun));
  if (shouldRun("gitignore")) steps.push(ensureGitignore(projectDir, options.dryRun));

  // 3. MCP dependencies
  if (shouldRun("deps")) {
    const depResults = await installAllMcpDeps(projectDir);
    const ready = depResults.filter((r) => r.status === "installed" || r.status === "already_available");
    steps.push({
      step: "deps",
      status: "up-to-date",
      message: `MCP dependencies: ${ready.length}/${depResults.length} ready`,
    });
  }

  // 4. AI instruction files
  if (shouldRun("claude-md")) steps.push(generateAndWriteClaudeMd(projectDir, options.dryRun));
  if (shouldRun("copilot-md")) steps.push(generateAndWriteCopilotInstructions(projectDir, options.dryRun));

  const report: UpdateReport = {
    steps,
    hasChanges: steps.some((s) => s.status === "updated" || s.status === "created"),
  };

  logger.info("mcp-graph update complete", {
    updated: steps.filter((s) => s.status === "updated").length,
    upToDate: steps.filter((s) => s.status === "up-to-date").length,
  });

  return report;
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
