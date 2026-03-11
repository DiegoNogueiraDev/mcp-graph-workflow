/**
 * GitNexus API bridge routes.
 * Proxies requests to the local GitNexus instance.
 * All data stays local — no external communication.
 */

import { Router } from "express";
import { z } from "zod/v4";
import {
  isGitNexusIndexed,
  isGitNexusRunning,
  getAnalyzePhase,
  ensureGitNexusAnalyzed,
  startGitNexusServe,
} from "../../core/integrations/gitnexus-launcher.js";
import { logger } from "../../core/utils/logger.js";
import {
  buildContextQuery,
  buildImpactQuery,
  parseContextResponse,
  parseImpactResponse,
} from "../../core/integrations/gitnexus-queries.js";

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

    // Handle non-JSON responses (e.g. HTML 404 pages) gracefully
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { ok: false, status: res.status, data: { error: `Non-JSON response from GitNexus (${res.status})` } };
    }

    const data: unknown = await res.json();
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
        analyzePhase: getAnalyzePhase(),
        ...(running ? { url: `http://localhost:${gitnexusPort}` } : {}),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /analyze ────────────────────────────────
  router.post("/analyze", async (_req, res, next) => {
    try {
      const result = await ensureGitNexusAnalyzed(basePath);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── POST /serve ─────────────────────────────────
  router.post("/serve", async (_req, res, next) => {
    try {
      const result = await startGitNexusServe(basePath, gitnexusPort);
      res.json(result);
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

      const result = await proxyToGitNexus(gitnexusPort, "/api/query", { cypher: parsed.data.query });
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

      // Try direct proxy first, fallback to Cypher query
      const result = await proxyToGitNexus(gitnexusPort, "/api/context", { symbol: parsed.data.symbol });
      if (result.status === 404) {
        logger.debug("GitNexus /api/context returned 404, falling back to Cypher query", { symbol: parsed.data.symbol });
        const cypher = buildContextQuery(parsed.data.symbol);
        const cypherResult = await proxyToGitNexus(gitnexusPort, "/api/query", { cypher });
        if (!cypherResult.ok) {
          res.status(cypherResult.status).json(cypherResult.data);
          return;
        }
        const contextData = parseContextResponse(cypherResult.data);
        res.json(contextData);
        return;
      }
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

      // Try direct proxy first, fallback to Cypher query
      const result = await proxyToGitNexus(gitnexusPort, "/api/impact", { symbol: parsed.data.symbol });
      if (result.status === 404) {
        logger.debug("GitNexus /api/impact returned 404, falling back to Cypher query", { symbol: parsed.data.symbol });
        const cypher = buildImpactQuery(parsed.data.symbol);
        const cypherResult = await proxyToGitNexus(gitnexusPort, "/api/query", { cypher });
        if (!cypherResult.ok) {
          res.status(cypherResult.status).json(cypherResult.data);
          return;
        }
        const impactData = parseImpactResponse(cypherResult.data, parsed.data.symbol);
        res.json(impactData);
        return;
      }
      res.status(result.status).json(result.data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
