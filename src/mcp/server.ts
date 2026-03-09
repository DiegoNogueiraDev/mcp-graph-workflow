#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAllTools } from "./tools/index.js";
import { createApiRouter } from "../api/router.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { logger } from "../core/utils/logger.js";
import { loadConfig } from "../core/config/config-loader.js";
import { ensureGitNexusAnalyzed, startGitNexusServe, stopGitNexus } from "../core/integrations/gitnexus-launcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "web", "dashboard", "dist");

const config = loadConfig();
const PORT = config.port;

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

// ── Express + Streamable HTTP transport ──────────────────
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  await mcp.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// REST API
app.use("/api/v1", createApiRouter({ store, basePath: process.cwd(), eventBus }));

// Static files (dashboard)
app.use(express.static(publicDir));

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, server: "mcp-graph" });
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
function cleanup(): void {
  stopGitNexus().catch(() => {});
  store.close();
  process.exit(0);
}
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

app.listen(PORT, () => {
  logger.info(`mcp-graph server listening on http://localhost:${PORT}/mcp`);
});
