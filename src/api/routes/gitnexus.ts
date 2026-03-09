/**
 * GitNexus API bridge routes.
 * Proxies requests to the local GitNexus instance.
 * All data stays local — no external communication.
 */

import { Router } from "express";
import { z } from "zod/v4";
import { isGitNexusIndexed, isGitNexusRunning } from "../../core/integrations/gitnexus-launcher.js";
import { logger } from "../../core/utils/logger.js";

const QueryBodySchema = z.object({ query: z.string().min(1) });
const SymbolBodySchema = z.object({ symbol: z.string().min(1) });

const DEFAULT_GITNEXUS_PORT = 3737;

export interface GitNexusRouterOptions {
  basePath: string;
  gitnexusPort?: number;
}

async function proxyToGitNexus(
  port: number,
  endpoint: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`http://localhost:${port}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 502, data: { error: `GitNexus proxy error: ${message}` } };
  }
}

export function createGitNexusRouter(options: GitNexusRouterOptions): Router {
  const { basePath, gitnexusPort = DEFAULT_GITNEXUS_PORT } = options;
  const router = Router();

  // ── GET /status ───────────────────────────────
  router.get("/status", async (_req, res, next) => {
    try {
      const indexed = isGitNexusIndexed(basePath);
      const running = await isGitNexusRunning(gitnexusPort);

      res.json({
        indexed,
        running,
        port: gitnexusPort,
        ...(running ? { url: `http://localhost:${gitnexusPort}` } : {}),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /query ───────────────────────────────
  router.post("/query", async (req, res, next) => {
    try {
      const parsed = QueryBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Missing required field: query" });
        return;
      }

      const running = await isGitNexusRunning(gitnexusPort);
      if (!running) {
        res.status(503).json({ error: "GitNexus is not running. Start with: gitnexus serve" });
        return;
      }

      const result = await proxyToGitNexus(gitnexusPort, "/api/query", { query: parsed.data.query });
      res.status(result.status).json(result.data);
    } catch (err) {
      next(err);
    }
  });

  // ── POST /context ─────────────────────────────
  router.post("/context", async (req, res, next) => {
    try {
      const parsed = SymbolBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Missing required field: symbol" });
        return;
      }

      const running = await isGitNexusRunning(gitnexusPort);
      if (!running) {
        res.status(503).json({ error: "GitNexus is not running. Start with: gitnexus serve" });
        return;
      }

      const result = await proxyToGitNexus(gitnexusPort, "/api/context", { symbol: parsed.data.symbol });
      res.status(result.status).json(result.data);
    } catch (err) {
      next(err);
    }
  });

  // ── POST /impact ──────────────────────────────
  router.post("/impact", async (req, res, next) => {
    try {
      const parsed = SymbolBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Missing required field: symbol" });
        return;
      }

      const running = await isGitNexusRunning(gitnexusPort);
      if (!running) {
        res.status(503).json({ error: "GitNexus is not running. Start with: gitnexus serve" });
        return;
      }

      const result = await proxyToGitNexus(gitnexusPort, "/api/impact", { symbol: parsed.data.symbol });
      res.status(result.status).json(result.data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
