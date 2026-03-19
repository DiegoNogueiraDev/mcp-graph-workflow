/**
 * Code Graph API routes — native Code Intelligence engine.
 * Replaces GitNexus API bridge with local TypeScript-based code analysis.
 */

import { Router } from "express";
import { z } from "zod/v4";
import { CodeStore } from "../../core/code/code-store.js";
import { CodeIndexer } from "../../core/code/code-indexer.js";
import { getSymbolContext, analyzeImpact, getFullGraph } from "../../core/code/graph-traversal.js";
import { searchCodeSymbols } from "../../core/code/code-search.js";
import { detectProcesses } from "../../core/code/process-detector.js";
import type { StoreRef } from "../../core/store/store-manager.js";
import { logger } from "../../core/utils/logger.js";

const SymbolBodySchema = z.object({ symbol: z.string().min(1) });
const SearchBodySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
  rerank: z.boolean().optional(),
});
const ImpactBodySchema = z.object({
  symbol: z.string().min(1),
  direction: z.enum(["upstream", "downstream"]).optional(),
  maxDepth: z.number().int().min(1).max(5).optional(),
});

export interface CodeGraphRouterOptions {
  storeRef: StoreRef;
  getBasePath: () => string;
}

export function createCodeGraphRouter(options: CodeGraphRouterOptions): Router {
  const { storeRef, getBasePath } = options;
  const router = Router();

  function getCodeStore(): CodeStore {
    return new CodeStore(storeRef.current.getDb());
  }

  function getProjectId(): string {
    const project = storeRef.current.getProject();
    return project?.id ?? "default";
  }

  // ── GET /status ───────────────────────────────
  router.get("/status", (_req, res, next) => {
    try {
      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const meta = codeStore.getIndexMeta(projectId);

      res.json({
        indexed: meta !== null,
        basePath: getBasePath(),
        symbolCount: meta?.symbolCount ?? 0,
        relationCount: meta?.relationCount ?? 0,
        fileCount: meta?.fileCount ?? 0,
        lastIndexed: meta?.lastIndexed ?? null,
        gitHash: meta?.gitHash ?? null,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /reindex ─────────────────────────────
  router.post("/reindex", async (_req, res, next) => {
    try {
      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const basePath = getBasePath();

      logger.info("code-graph:reindex:start", { basePath });

      const indexer = new CodeIndexer(codeStore, projectId);
      codeStore.deleteAllSymbols(projectId);
      const result = await indexer.indexDirectory(basePath, basePath);

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /search ──────────────────────────────
  router.post("/search", (req, res, next) => {
    try {
      const parsed = SearchBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
        return;
      }

      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const results = searchCodeSymbols(codeStore, parsed.data.query, projectId, {
        limit: parsed.data.limit,
        rerank: parsed.data.rerank,
      });

      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /context ─────────────────────────────
  router.post("/context", (req, res, next) => {
    try {
      const parsed = SymbolBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Missing required field: symbol" });
        return;
      }

      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const context = getSymbolContext(codeStore, parsed.data.symbol, projectId);

      res.json(context);
    } catch (err) {
      next(err);
    }
  });

  // ── POST /impact ──────────────────────────────
  router.post("/impact", (req, res, next) => {
    try {
      const parsed = ImpactBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Missing required field: symbol" });
        return;
      }

      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const impact = analyzeImpact(
        codeStore,
        parsed.data.symbol,
        projectId,
        parsed.data.direction,
        parsed.data.maxDepth,
      );

      res.json(impact);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /full ─────────────────────────────────
  router.get("/full", (req, res, next) => {
    try {
      const limit = parseInt(String(req.query.limit ?? "500"), 10);
      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const graph = getFullGraph(codeStore, projectId, limit);

      res.json(graph);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /processes ────────────────────────────
  router.get("/processes", (_req, res, next) => {
    try {
      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const processes = detectProcesses(codeStore, projectId);

      res.json({ processes });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
