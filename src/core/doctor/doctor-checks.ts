import { existsSync, readFileSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import type { SqliteStore } from "../store/sqlite-store.js";
import { STORE_DIR, DB_FILE } from "../utils/constants.js";
import { fileExists } from "../utils/fs.js";
import { getIntegrationsStatus } from "../integrations/tool-status.js";
import { logger } from "../utils/logger.js";
import type { CheckResult } from "./doctor-types.js";

const MIN_NODE_VERSION = 20;

/**
 * Check Node.js version >= 20 using the current runtime.
 */
export function checkNodeVersion(): CheckResult {
  return checkNodeVersionWith(process.versions.node);
}

/**
 * Check Node.js version >= 20 with an explicit version string (testable).
 */
export function checkNodeVersionWith(version: string): CheckResult {
  const major = parseInt(version.split(".")[0], 10);
  if (major >= MIN_NODE_VERSION) {
    return {
      name: "node-version",
      level: "ok",
      message: `Node.js v${version} (>= ${MIN_NODE_VERSION})`,
    };
  }
  return {
    name: "node-version",
    level: "error",
    message: `Node.js v${version} is below minimum v${MIN_NODE_VERSION}`,
    suggestion: `Upgrade Node.js to v${MIN_NODE_VERSION} or later: https://nodejs.org`,
  };
}

/**
 * Check write permissions on the store directory.
 */
export async function checkWritePermissions(basePath: string): Promise<CheckResult> {
  const storeDir = path.join(basePath, STORE_DIR);
  try {
    await access(storeDir, constants.W_OK);
    return {
      name: "write-permissions",
      level: "ok",
      message: `Write access to ${STORE_DIR}/`,
    };
  } catch {
    // If store dir doesn't exist, check parent
    try {
      await access(basePath, constants.W_OK);
      return {
        name: "write-permissions",
        level: "ok",
        message: `Write access to project directory (${STORE_DIR}/ will be created)`,
      };
    } catch {
      return {
        name: "write-permissions",
        level: "error",
        message: `No write access to ${basePath}`,
        suggestion: `Check directory permissions: chmod u+w "${basePath}"`,
      };
    }
  }
}

/**
 * Check that the SQLite database exists and can be opened.
 */
export async function checkSqliteDatabase(basePath: string): Promise<CheckResult> {
  const dbPath = path.join(basePath, STORE_DIR, DB_FILE);
  if (!existsSync(dbPath)) {
    return {
      name: "sqlite-database",
      level: "error",
      message: `Database not found at ${STORE_DIR}/${DB_FILE}`,
      suggestion: "Run 'mcp-graph init' to create the database",
    };
  }
  try {
    const db = new Database(dbPath, { readonly: true });
    db.close();
    return {
      name: "sqlite-database",
      level: "ok",
      message: `Database exists at ${STORE_DIR}/${DB_FILE}`,
    };
  } catch (err) {
    return {
      name: "sqlite-database",
      level: "error",
      message: `Database corrupt or unreadable: ${err instanceof Error ? err.message : String(err)}`,
      suggestion: "Try restoring from a snapshot or re-running 'mcp-graph init'",
    };
  }
}

/**
 * Check database integrity via PRAGMA integrity_check.
 */
export async function checkDbIntegrity(basePath: string): Promise<CheckResult> {
  const dbPath = path.join(basePath, STORE_DIR, DB_FILE);
  if (!existsSync(dbPath)) {
    return {
      name: "db-integrity",
      level: "error",
      message: "Cannot check integrity — database not found",
    };
  }
  try {
    const db = new Database(dbPath, { readonly: true });
    const result = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    db.close();
    const isOk = result.length === 1 && result[0].integrity_check === "ok";
    if (isOk) {
      return {
        name: "db-integrity",
        level: "ok",
        message: "Database integrity check passed",
      };
    }
    return {
      name: "db-integrity",
      level: "error",
      message: `Database integrity issues: ${result.map((r) => r.integrity_check).join(", ")}`,
      suggestion: "Restore from a snapshot: mcp-graph snapshot --restore <id>",
    };
  } catch (err) {
    return {
      name: "db-integrity",
      level: "error",
      message: `Integrity check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check if the graph project is initialized.
 */
export function checkGraphInitialized(store: SqliteStore): CheckResult {
  try {
    const project = store.getProject();
    if (project) {
      return {
        name: "graph-initialized",
        level: "ok",
        message: `Project "${project.name}" initialized`,
      };
    }
    return {
      name: "graph-initialized",
      level: "warning",
      message: "No project initialized",
      suggestion: "Run 'mcp-graph init' to initialize a project",
    };
  } catch {
    return {
      name: "graph-initialized",
      level: "warning",
      message: "Could not check project initialization",
      suggestion: "Run 'mcp-graph init' to initialize a project",
    };
  }
}

/**
 * Check if the config file exists and is valid.
 */
export function checkConfigFile(basePath: string): CheckResult {
  const configPath = path.join(basePath, "mcp-graph.config.json");
  if (!existsSync(configPath)) {
    return {
      name: "config-file",
      level: "ok",
      message: "No config file — using defaults",
    };
  }
  try {
    const raw = readFileSync(configPath, "utf-8");
    JSON.parse(raw);
    return {
      name: "config-file",
      level: "ok",
      message: "Config file is valid JSON",
    };
  } catch (err) {
    return {
      name: "config-file",
      level: "warning",
      message: `Config file has invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      suggestion: "Fix the JSON syntax in mcp-graph.config.json",
    };
  }
}

/**
 * Check if the dashboard build artifacts exist.
 */
export async function checkDashboardBuild(basePath: string): Promise<CheckResult> {
  const dashboardIndex = path.join(basePath, "dist", "web", "dashboard", "index.html");
  const exists = await fileExists(dashboardIndex);
  if (exists) {
    return {
      name: "dashboard-build",
      level: "ok",
      message: "Dashboard build found",
    };
  }
  return {
    name: "dashboard-build",
    level: "warning",
    message: "Dashboard build not found",
    suggestion: "Run 'npm run build' to build the dashboard",
  };
}

/**
 * Check if .mcp.json exists and is valid.
 */
export function checkMcpJson(basePath: string): CheckResult {
  const mcpPath = path.join(basePath, ".mcp.json");
  if (!existsSync(mcpPath)) {
    return {
      name: "mcp-json",
      level: "warning",
      message: ".mcp.json not found",
      suggestion: "Create .mcp.json with MCP server configuration",
    };
  }
  try {
    const raw = readFileSync(mcpPath, "utf-8");
    JSON.parse(raw);
    return {
      name: "mcp-json",
      level: "ok",
      message: ".mcp.json is valid",
    };
  } catch {
    return {
      name: "mcp-json",
      level: "warning",
      message: ".mcp.json has invalid JSON",
      suggestion: "Fix the JSON syntax in .mcp.json",
    };
  }
}

/**
 * Check integration tools (Code Graph, Memories, Playwright).
 */
export async function checkIntegrations(basePath: string): Promise<CheckResult[]> {
  try {
    const status = await getIntegrationsStatus(basePath);
    const results: CheckResult[] = [];

    // Code Graph
    results.push({
      name: "integration-code-graph",
      level: status.codeGraph.running ? "ok" : "warning",
      message: status.codeGraph.running
        ? `Code Graph indexed (${status.codeGraph.symbolCount} symbols)`
        : "Code Graph not indexed",
      ...(!status.codeGraph.running && {
        suggestion: "Run code graph reindex via dashboard or API",
      }),
    });

    // Memories
    results.push({
      name: "integration-memories",
      level: status.memories.available ? "ok" : "warning",
      message: status.memories.available
        ? `Memories available (${status.memories.count} memories in ${status.memories.directory})`
        : "No memories found",
      ...(!status.memories.available && {
        suggestion: "Create memories in workflow-graph/memories/ or use write_memory MCP tool",
      }),
    });

    // Playwright
    results.push({
      name: "integration-playwright",
      level: status.playwright.installed ? "ok" : "warning",
      message: status.playwright.installed
        ? "Playwright available"
        : "Playwright not available",
      ...(!status.playwright.installed && {
        suggestion: "Install Playwright: npx playwright install",
      }),
    });

    return results;
  } catch (err) {
    logger.debug("doctor:integrations:fail", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [
      {
        name: "integration-code-graph",
        level: "warning",
        message: "Could not check Code Graph status",
      },
      {
        name: "integration-memories",
        level: "warning",
        message: "Could not check Memories status",
      },
      {
        name: "integration-playwright",
        level: "warning",
        message: "Could not check Playwright status",
      },
    ];
  }
}
