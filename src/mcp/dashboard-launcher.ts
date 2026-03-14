import type { Express } from "express";
import type { Server } from "node:http";
import { execFile } from "node:child_process";
import { logger } from "../core/utils/logger.js";

/**
 * Start the dashboard HTTP server in the background and auto-open the browser.
 * Tries the preferred port first; if taken, finds a free port automatically.
 * Never blocks MCP stdio and never writes to stdout.
 */
export async function startDashboard(app: Express, preferredPort: number): Promise<Server> {
  const server = await listen(app, preferredPort);
  const port = (server.address() as { port: number }).port;

  logger.info(`Dashboard running at http://localhost:${port}`);
  openBrowser(`http://localhost:${port}`);

  return server;
}

function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    server.once("listening", () => resolve(server));

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Port taken — let OS pick a free one
        logger.info(`Port ${port} in use, finding free port...`);
        const fallback = app.listen(0);
        fallback.once("listening", () => resolve(fallback));
        fallback.once("error", reject);
      } else {
        reject(err);
      }
    });
  });
}

function openBrowser(url: string): void {
  // Skip in headless/CI environments
  if (process.env.CI || process.env.DOCKER || !process.stderr.isTTY) {
    logger.info("Headless environment detected, skipping browser open");
    return;
  }

  const platform = process.platform;
  let cmd: string;
  let args: string[];

  switch (platform) {
    case "darwin":
      cmd = "open";
      args = [url];
      break;
    case "win32":
      cmd = "cmd";
      args = ["/c", "start", "", url];
      break;
    default: // linux
      cmd = "xdg-open";
      args = [url];
      break;
  }

  execFile(cmd, args, (err) => {
    if (err) {
      logger.warn("Could not open browser automatically", {
        error: err.message,
      });
    }
  });
}
