import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ConfigSchema, type McpGraphConfig } from "./config-schema.js";
import { logger } from "../utils/logger.js";

const CONFIG_FILENAME = "mcp-graph.config.json";

export function loadConfig(basePath?: string): McpGraphConfig {
  const resolvedBase = basePath ?? process.cwd();
  const configPath = path.join(resolvedBase, CONFIG_FILENAME);

  let fileConfig: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      fileConfig = JSON.parse(raw) as Record<string, unknown>;
      logger.info(`Config loaded from ${configPath}`);
    } catch (err) {
      logger.error(`Failed to parse config at ${configPath}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.info("No config file found, using defaults");
  }

  // Env var overrides
  if (process.env.MCP_PORT) {
    const envPort = parseInt(process.env.MCP_PORT, 10);
    if (!isNaN(envPort)) {
      fileConfig.port = envPort;
    }
  }

  if (process.env.CODE_GRAPH_AUTO_INDEX) {
    const integrations = (fileConfig.integrations ?? {}) as Record<string, unknown>;
    integrations.codeGraphAutoIndex = process.env.CODE_GRAPH_AUTO_INDEX !== "false";
    fileConfig.integrations = integrations;
  }

  const config = ConfigSchema.parse(fileConfig);
  return config;
}
