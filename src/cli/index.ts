#!/usr/bin/env node
import { Command } from "commander";
import { serveCommand } from "./commands/serve.js";
import { importCommand } from "./commands/import-cmd.js";
import { statsCommand } from "./commands/stats.js";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("mcp-graph")
  .description("Local-first PRD to task graph — transforms text into executable structure")
  .version("1.0.0");

program.addCommand(serveCommand());
program.addCommand(importCommand());
program.addCommand(statsCommand());
program.addCommand(initCommand());

program.parse();
