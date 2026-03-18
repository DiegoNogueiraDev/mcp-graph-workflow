import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Express } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { StoreManager } from "../core/store/store-manager.js";
import type { GraphEventBus } from "../core/events/event-bus.js";
import { createApiRouter } from "../api/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "web", "dashboard", "dist");

export interface AppFactoryOptions {
  store: SqliteStore;
  basePath: string;
  eventBus: GraphEventBus;
  mcp?: McpServer;
  storeManager?: StoreManager;
}

export function createApp(options: AppFactoryOptions): Express {
  const { store, basePath, eventBus, mcp, storeManager } = options;

  const app = express();
  app.use(express.json());

  // MCP HTTP transport (optional — only when MCP server is provided)
  if (mcp) {
    app.post("/mcp", async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });
  }

  // REST API
  app.use("/api/v1", createApiRouter({ store, basePath, eventBus, storeManager }));

  // Static files (dashboard)
  app.use(express.static(publicDir));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ ok: true, server: "mcp-graph" });
  });

  return app;
}
