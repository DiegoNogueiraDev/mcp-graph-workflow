import { existsSync } from "node:fs";
import path from "node:path";
import { SqliteStore } from "../store/sqlite-store.js";
import { STORE_DIR, DB_FILE } from "../utils/constants.js";
import { logger } from "../utils/logger.js";
import type { CheckResult, DoctorReport } from "./doctor-types.js";
import {
  checkNodeVersion,
  checkWritePermissions,
  checkSqliteDatabase,
  checkDbIntegrity,
  checkGraphInitialized,
  checkConfigFile,
  checkDashboardBuild,
  checkMcpJson,
  checkIntegrations,
} from "./doctor-checks.js";

function buildSummary(checks: CheckResult[]): DoctorReport["summary"] {
  let ok = 0;
  let warning = 0;
  let error = 0;
  for (const c of checks) {
    if (c.level === "ok") ok++;
    else if (c.level === "warning") warning++;
    else error++;
  }
  return { ok, warning, error };
}

/**
 * Run all doctor checks and return a structured report.
 */
export async function runDoctor(basePath: string): Promise<DoctorReport> {
  logger.info("Running doctor checks", { basePath });

  const checks: CheckResult[] = [];

  // 1. Sync checks
  checks.push(checkNodeVersion());
  checks.push(checkConfigFile(basePath));
  checks.push(checkMcpJson(basePath));

  // 2. Async checks (parallel where possible)
  const [writeResult, sqliteResult, dbIntegrityResult, dashboardResult, integrationResults] =
    await Promise.all([
      checkWritePermissions(basePath),
      checkSqliteDatabase(basePath),
      checkDbIntegrity(basePath),
      checkDashboardBuild(basePath),
      checkIntegrations(basePath),
    ]);

  checks.push(writeResult);
  checks.push(sqliteResult);
  checks.push(dbIntegrityResult);
  checks.push(dashboardResult);
  checks.push(...integrationResults);

  // 3. Store-dependent checks (only if DB exists)
  const dbPath = path.join(basePath, STORE_DIR, DB_FILE);
  if (existsSync(dbPath)) {
    try {
      const store = SqliteStore.open(basePath);
      try {
        checks.push(checkGraphInitialized(store));
      } finally {
        store.close();
      }
    } catch (err) {
      checks.push({
        name: "graph-initialized",
        level: "warning",
        message: `Could not open store: ${err instanceof Error ? err.message : String(err)}`,
        suggestion: "Run 'mcp-graph init' to initialize the project",
      });
    }
  }

  const summary = buildSummary(checks);

  return {
    checks,
    summary,
    passed: summary.error === 0,
  };
}
