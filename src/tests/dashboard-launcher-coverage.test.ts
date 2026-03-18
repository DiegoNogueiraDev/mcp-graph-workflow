/**
 * Tests for dashboard-launcher.ts — startDashboard function.
 * Verifies HTTP server startup and port-conflict fallback behavior.
 */
import { describe, it, expect, afterEach } from "vitest";
import express from "express";
import type { Server } from "node:http";

const servers: Server[] = [];

function trackServer(server: Server): Server {
  servers.push(server);
  return server;
}

async function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

afterEach(async () => {
  for (const server of servers) {
    await closeServer(server).catch(() => {});
  }
  servers.length = 0;
});

describe("startDashboard", () => {
  it("should start dashboard on a free port when port 0 is requested", async () => {
    const { startDashboard } = await import("../mcp/dashboard-launcher.js");
    const app = express();
    app.get("/health", (_req, res) => res.json({ ok: true }));

    const server = trackServer(await startDashboard(app, 0));
    const addr = server.address() as { port: number };

    expect(addr.port).toBeGreaterThan(0);
  });

  it("should find free port when preferred port is already taken", async () => {
    const { startDashboard } = await import("../mcp/dashboard-launcher.js");
    const app1 = express();
    const app2 = express();

    // Start first server on a random port
    const server1 = trackServer(await startDashboard(app1, 0));
    const port1 = (server1.address() as { port: number }).port;

    // Try to start second server on same port — should find a free one
    const server2 = trackServer(await startDashboard(app2, port1));
    const port2 = (server2.address() as { port: number }).port;

    expect(port2).not.toBe(port1);
    expect(port2).toBeGreaterThan(0);
  });

  it("should return a valid Server instance", async () => {
    const { startDashboard } = await import("../mcp/dashboard-launcher.js");
    const app = express();

    const server = trackServer(await startDashboard(app, 0));

    expect(server).toBeDefined();
    expect(server.listening).toBe(true);
    expect(typeof server.close).toBe("function");
  });
});
