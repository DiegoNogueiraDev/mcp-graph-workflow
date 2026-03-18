#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { logger } from "../core/utils/logger.js";
import { loadConfig } from "../core/config/config-loader.js";
import { createApp } from "./app-factory.js";
import { StoreManager } from "../core/store/store-manager.js";
import { CodeStore } from "../core/code/code-store.js";
import { CodeIndexer } from "../core/code/code-indexer.js";

const config = loadConfig();
const PORT = config.port;

// ── Store Manager + Event Bus ────────────────────────────
const storeManager = StoreManager.create(process.cwd());
const eventBus = new GraphEventBus();
storeManager.store.eventBus = eventBus;

// ── MCP Server ───────────────────────────────────────────
const mcp = new McpServer(
  { name: "mcp-graph", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

registerAllTools(mcp, storeManager.store);

// ── Express app ──────────────────────────────────────────
const app = createApp({
  store: storeManager.store,
  basePath: storeManager.basePath,
  eventBus,
  mcp,
  storeManager,
});

// ── Code Graph auto-index ────────────────────────────────
if (config.integrations.codeGraphAutoIndex) {
  const basePath = storeManager.basePath;
  try {
    const project = storeManager.store.getProject();
    if (project) {
      const codeStore = new CodeStore(storeManager.store.getDb());
      const indexer = new CodeIndexer(codeStore, project.id);
      const result = indexer.indexDirectory(basePath, basePath);
      logger.info("Code graph auto-indexed", {
        files: result.fileCount,
        symbols: result.symbolCount,
        relations: result.relationCount,
      });
    }
  } catch (err) {
    logger.warn("Code graph auto-index failed (non-blocking)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Cleanup on shutdown ──────────────────────────────────
function cleanup(signal: string): void {
  logger.info("server:shutdown", { signal });
  storeManager.close();
  logger.info("server:shutdown:ok", { signal });
  process.exit(0);
}
process.on("SIGTERM", () => cleanup("SIGTERM"));
process.on("SIGINT", () => cleanup("SIGINT"));
process.on("SIGHUP", () => cleanup("SIGHUP"));

app.listen(PORT, () => {
  logger.info(`mcp-graph server listening on http://localhost:${PORT}/mcp`);
});
