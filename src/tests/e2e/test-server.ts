/**
 * Lightweight Express server for E2E tests.
 * Uses file-based SQLite stores with fixture data.
 * Supports StoreManager for Open Folder E2E tests.
 */
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import express from "express";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { StoreManager } from "../../core/store/store-manager.js";
import { createApiRouter } from "../../api/router.js";
import { GraphEventBus } from "../../core/events/event-bus.js";
import { readFileContent } from "../../core/parser/file-reader.js";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";
import { logger } from "../../core/utils/logger.js";
import { STORE_DIR } from "../../core/utils/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "..", "web", "dashboard", "dist");
const fixtureDir = path.join(__dirname, "..", "fixtures");

const PORT = 3377;

/** Create a temp project directory with initialized DB */
function createTempProject(name: string): string {
  const dir = path.join(os.tmpdir(), `mcp-graph-e2e-${name}-${Date.now()}`);
  mkdirSync(path.join(dir, STORE_DIR), { recursive: true });
  const store = SqliteStore.open(dir);
  store.initProject(name);
  store.close();
  return dir;
}

/** Tracks temp dirs for cleanup on shutdown */
const tempDirs: string[] = [];

async function startServer(): Promise<void> {
  // Create primary project dir with fixture data
  const primaryDir = createTempProject("E2E Test Project");
  tempDirs.push(primaryDir);

  // Create secondary project dir (different data, for swap tests)
  const secondaryDir = createTempProject("Secondary Project");
  tempDirs.push(secondaryDir);

  // Add some nodes to secondary project
  const secondaryStore = SqliteStore.open(secondaryDir);
  secondaryStore.insertNode({
    id: "node-secondary-1",
    type: "epic",
    title: "Secondary Epic Alpha",
    status: "backlog",
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  secondaryStore.insertNode({
    id: "node-secondary-2",
    type: "task",
    title: "Secondary Task Beta",
    status: "in_progress",
    priority: 2,
    parentId: "node-secondary-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  secondaryStore.close();

  // Create an empty project dir (for testing swap to empty project)
  const emptyDir = createTempProject("Empty Project");
  tempDirs.push(emptyDir);

  // Open primary store via StoreManager
  const storeManager = StoreManager.create(primaryDir);
  const eventBus = new GraphEventBus();
  storeManager.store.eventBus = eventBus;

  // Import fixture PRD into primary project
  const fixturePath = path.join(fixtureDir, "sample-prd.txt");
  try {
    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    storeManager.store.bulkInsert(graph.nodes, graph.edges);
    logger.info("E2E fixture loaded", {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
    });
  } catch (err) {
    logger.warn("Could not load fixture PRD, starting with empty graph", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const app = express();
  app.use(express.json());

  // REST API (with StoreManager for folder swap support)
  app.use("/api/v1", createApiRouter({ store: storeManager.store, basePath: primaryDir, eventBus, storeManager }));

  // E2E helper — expose temp project paths for tests
  app.get("/api/v1/e2e/projects", (_req, res) => {
    res.json({
      primary: primaryDir,
      secondary: secondaryDir,
      empty: emptyDir,
    });
  });

  // Static files (dashboard)
  app.use(express.static(publicDir));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ ok: true, server: "mcp-graph-e2e" });
  });

  app.listen(PORT, () => {
    logger.info(`E2E test server listening on http://localhost:${PORT}`);
  });

  // Cleanup temp dirs on shutdown
  function cleanup(): void {
    storeManager.close();
    for (const dir of tempDirs) {
      try {
        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
      } catch { /* ignore cleanup errors */ }
    }
    process.exit(0);
  }
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

startServer().catch((err) => {
  logger.error("Failed to start E2E test server", { error: String(err) });
  process.exit(1);
});
