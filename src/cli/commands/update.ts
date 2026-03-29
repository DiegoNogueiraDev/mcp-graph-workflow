import { Command } from "commander";
import path from "node:path";
import { runUpdate } from "../../mcp/init-project.js";
import { getErrorMessage } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";
import type { UpdateStepResult } from "../../mcp/init-project.js";

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

const STATUS_ICON: Record<string, string> = {
  updated: "\u2191",
  "up-to-date": "\u2713",
  created: "+",
  skipped: "-",
  error: "\u2717",
};

function formatStep(step: UpdateStepResult): string {
  const icon = STATUS_ICON[step.status] ?? "?";
  return `  ${icon} ${step.step.padEnd(12)} ${step.message}`;
}

export function updateCommand(): Command {
  return new Command("update")
    .description("Update mcp-graph configuration to latest version")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("--only <steps>", "Comma-separated: db,mcp-json,vscode-mcp,gitignore,deps,claude-md,copilot-md,ignore-files,docs")
    .option("--dry-run", "Show what would change without writing")
    .option("--json", "Output as JSON")
    .action(async (opts: { dir: string; only?: string; dryRun?: boolean; json?: boolean }) => {
      const dir = path.resolve(opts.dir);
      const only = opts.only ? opts.only.split(",").map((s) => s.trim()) : undefined;

      try {
        const report = await runUpdate(dir, { only, dryRun: opts.dryRun });

        if (opts.json) {
          output(JSON.stringify(report, null, 2));
        } else {
          output("mcp-graph update\n");

          for (const step of report.steps) {
            output(formatStep(step));
          }

          const updated = report.steps.filter((s) => s.status === "updated" || s.status === "created").length;
          const upToDate = report.steps.filter((s) => s.status === "up-to-date").length;

          output("");
          output(`Summary: ${updated} updated, ${upToDate} up-to-date`);

          if (opts.dryRun) {
            output("\n(dry run — no files were modified)");
          }
        }
      } catch (err) {
        if (opts.json) {
          output(JSON.stringify({ error: getErrorMessage(err) }, null, 2));
        } else {
          logger.error(`Update failed: ${getErrorMessage(err)}`);
          output("\nRun 'mcp-graph init' to initialize this project first.");
        }
        process.exitCode = 1;
      }
    });
}
