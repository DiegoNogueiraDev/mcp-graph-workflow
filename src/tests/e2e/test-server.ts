/**
 * Lightweight Express server for E2E tests.
 * Uses in-memory SQLite store with fixture data.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { createApiRouter } from "../../api/router.js";
import { GraphEventBus } from "../../core/events/event-bus.js";
import { readFileContent } from "../../core/parser/file-reader.js";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";
import { logger } from "../../core/utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "..", "web", "public");
const fixtureDir = path.join(__dirname, "..", "fixtures");

const PORT = 3377;

async function startServer(): Promise<void> {
  const store = SqliteStore.open(":memory:");
  store.initProject("E2E Test Project");

  const eventBus = new GraphEventBus();
  store.eventBus = eventBus;

  // Import fixture PRD for test data
  const fixturePath = path.join(fixtureDir, "sample-prd.txt");
  try {
    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    store.bulkInsert(graph.nodes, graph.edges);
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

  // REST API
  app.use("/api/v1", createApiRouter({ store, basePath: process.cwd(), eventBus }));

  // Static files (dashboard)
  app.use(express.static(publicDir));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ ok: true, server: "mcp-graph-e2e" });
  });

  app.listen(PORT, () => {
    logger.info(`E2E test server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  logger.error("Failed to start E2E test server", { error: String(err) });
  process.exit(1);
});
