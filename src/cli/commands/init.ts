import { Command } from "commander";
import path from "node:path";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { logger } from "../../core/utils/logger.js";

export function initCommand(): Command {
  return new Command("init")
    .description("Initialize mcp-graph in the current project")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("-n, --name <name>", "Project name")
    .action((opts: { dir: string; name?: string }) => {
      const dir = path.resolve(opts.dir);
      const projectName = opts.name ?? path.basename(dir);

      // Initialize store (creates .mcp-graph/graph.db)
      const store = SqliteStore.open(dir);
      store.initProject(projectName);
      console.log(`Graph initialized: ${projectName}`);

      // Generate .mcp.json if it doesn't exist
      const mcpConfigPath = path.join(dir, ".mcp.json");
      if (!existsSync(mcpConfigPath)) {
        const mcpConfig = {
          mcpServers: {
            "mcp-graph": {
              command: "npx",
              args: ["@diegonogueiradev_/mcp-graph"],
              cwd: dir,
            },
          },
        };
        writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2) + "\n");
        console.log("Created .mcp.json");
      } else {
        console.log(".mcp.json already exists");
      }

      // Detect Serena
      const serenaDir = path.join(dir, ".serena");
      if (existsSync(serenaDir)) {
        logger.info("Serena detected", { path: serenaDir });
      } else {
        logger.debug("Serena not found, code intelligence unavailable");
      }

      // Detect GitNexus
      const hasGitnexus = existsSync(path.join(dir, ".gitnexus"));
      if (hasGitnexus) {
        logger.info("GitNexus detected", { path: path.join(dir, ".gitnexus") });
      }

      console.log(`\nDashboard: mcp-graph serve --port 3000`);
      console.log(`Import PRD: mcp-graph import <file.md>`);
      console.log(`Stats: mcp-graph stats`);

      store.close();
    });
}
