import { Command } from "commander";
import { loadConfig } from "../../core/config/config-loader.js";

export function serveCommand(): Command {
  return new Command("serve")
    .description("Start the mcp-graph dashboard + API server")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .action(async (opts: { port: string }) => {
      const port = parseInt(opts.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error("Error: Invalid port number");
        process.exit(1);
      }

      // CLI flag overrides config — set env var so server picks it up
      process.env.MCP_PORT = String(port);

      // Dynamic import — server module starts Express on import
      await import("../../mcp/server.js");
    });
}
