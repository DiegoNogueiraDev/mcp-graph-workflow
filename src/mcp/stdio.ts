#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAllTools } from "./tools/index.js";
import { runInit } from "./init-project.js";

const args = process.argv.slice(2);

if (args.includes("--init") || args.includes("init")) {
  await runInit(process.cwd());
  process.exit(0);
}

// ── Store ────────────────────────────────────────────────
const store = SqliteStore.open(process.cwd());

// ── MCP Server ───────────────────────────────────────────
const mcp = new McpServer(
  { name: "mcp-graph", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

registerAllTools(mcp, store);

// ── Stdio transport ──────────────────────────────────────
const transport = new StdioServerTransport();
await mcp.connect(transport);
