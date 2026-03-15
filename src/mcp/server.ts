#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { logger } from "../core/utils/logger.js";
import { loadConfig } from "../core/config/config-loader.js";
import { ensureGitNexusAnalyzed, startGitNexusServe, stopGitNexus } from "../core/integrations/gitnexus-launcher.js";
import { createApp } from "./app-factory.js";
import { StoreManager } from "../core/store/store-manager.js";

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
  basePath: process.cwd(),
  eventBus,
  mcp,
  storeManager,
});

// ── GitNexus auto-start ──────────────────────────────────
if (config.integrations.gitnexusAutoStart) {
  const basePath = process.cwd();
  const gitnexusPort = config.integrations.gitnexusPort;

  ensureGitNexusAnalyzed(basePath).then(() => {
    return startGitNexusServe(basePath, gitnexusPort);
  }).then((result) => {
    if (result.started) {
      logger.info("GitNexus serve running", { port: gitnexusPort });
    }
  }).catch((err) => {
    logger.warn("GitNexus auto-start failed (non-blocking)", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

// ── Cleanup on shutdown ──────────────────────────────────
function cleanup(signal: string): void {
  logger.info("server:shutdown", { signal });
  stopGitNexus().catch(() => {});
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
