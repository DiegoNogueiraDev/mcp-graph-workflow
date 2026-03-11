import { Command } from "commander";
import path from "node:path";
import { runInit } from "../../mcp/init-project.js";
import { logger } from "../../core/utils/logger.js";

export function initCommand(): Command {
  return new Command("init")
    .description("Initialize mcp-graph in the current project")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("-n, --name <name>", "Project name")
    .action(async (opts: { dir: string; name?: string }) => {
      const dir = path.resolve(opts.dir);

      try {
        await runInit(dir);

        console.log(`\nDashboard: mcp-graph serve --port 3000`);
        console.log(`Import PRD: mcp-graph import <file.md>`);
        console.log(`Stats: mcp-graph stats`);
      } catch (error) {
        logger.error("Init failed", { error: error instanceof Error ? error.message : String(error) });
        process.exitCode = 1;
      }
    });
}
