import { Command } from "commander";
import path from "node:path";
import { runInit } from "../../mcp/init-project.js";
import { getErrorMessage } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

export function initCommand(): Command {
  return new Command("init")
    .description("Initialize mcp-graph in the current project")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("-n, --name <name>", "Project name")
    .action(async (opts: { dir: string; name?: string }) => {
      const dir = path.resolve(opts.dir);

      try {
        await runInit(dir);

        output(`\nDashboard: mcp-graph serve --port 3000`);
        output(`Import PRD: mcp-graph import <file.md>`);
        output(`Stats: mcp-graph stats`);
      } catch (error) {
        logger.error("Init failed", { error: getErrorMessage(error) });
        process.exitCode = 1;
      }
    });
}
