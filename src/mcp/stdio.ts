#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAllTools } from "./tools/index.js";
import { runInit } from "./init-project.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { loadConfig } from "../core/config/config-loader.js";
import { logger } from "../core/utils/logger.js";
import { createApp } from "./app-factory.js";
import { startDashboard } from "./dashboard-launcher.js";

const args = process.argv.slice(2);

if (args.includes("--init") || args.includes("init")) {
  await runInit(process.cwd());
  process.exit(0);
}

// ── Config ───────────────────────────────────────────────
const config = loadConfig();

// ── Store + Event Bus ────────────────────────────────────
const store = SqliteStore.open(process.cwd());
const eventBus = new GraphEventBus();
store.eventBus = eventBus;

// ── MCP Server ───────────────────────────────────────────
const mcp = new McpServer(
  { name: "mcp-graph", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

registerAllTools(mcp, store);

// ── Background dashboard (HTTP + auto-open browser) ──────
if (config.dashboard.autoOpen) {
  const app = createApp({ store, basePath: process.cwd(), eventBus });
  startDashboard(app, config.port).catch((err) => {
    logger.warn("Dashboard auto-start failed (non-blocking)", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

// ── Stdio transport ──────────────────────────────────────
const transport = new StdioServerTransport();
await mcp.connect(transport);
