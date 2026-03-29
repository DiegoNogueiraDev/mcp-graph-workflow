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
import { isTypeScriptAvailable } from "../../core/code/ts-analyzer.js";
import type { StoreRef } from "../../core/store/store-manager.js";
import { logger } from "../../core/utils/logger.js";
import { LspBridge } from "../../core/lsp/lsp-bridge.js";
import { LspServerManager } from "../../core/lsp/lsp-server-manager.js";
import { LspCache } from "../../core/lsp/lsp-cache.js";
import { LspDiagnosticsCollector } from "../../core/lsp/lsp-diagnostics.js";
import { ServerRegistry } from "../../core/lsp/server-registry.js";
import { detectProjectLanguages } from "../../core/lsp/language-detector.js";
import { estimateTokens } from "../../core/context/token-estimator.js";

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

const LspPositionSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().min(1),
  character: z.number().int().min(0),
});

const LspRenameSchema = LspPositionSchema.extend({
  newName: z.string().min(1),
});

const LspCallHierarchySchema = LspPositionSchema.extend({
  direction: z.enum(["incoming", "outgoing"]),
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
  router.get("/status", async (_req, res, next) => {
    try {
      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const meta = codeStore.getIndexMeta(projectId);
      const typescriptAvailable = await isTypeScriptAvailable();

      res.json({
        indexed: meta !== null,
        basePath: getBasePath(),
        symbolCount: meta?.symbolCount ?? 0,
        relationCount: meta?.relationCount ?? 0,
        fileCount: meta?.fileCount ?? 0,
        lastIndexed: meta?.lastIndexed ?? null,
        gitHash: meta?.gitHash ?? null,
        typescriptAvailable,
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
      const offset = parseInt(String(req.query.offset ?? "0"), 10);
      const codeStore = getCodeStore();
      const projectId = getProjectId();
      const graph = getFullGraph(codeStore, projectId, limit, offset);

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

  // ── LSP Routes ─────────────────────────────────────────

  let lspBridge: LspBridge | null = null;
  let lspManager: LspServerManager | null = null;

  function getOrCreateLspBridge(): LspBridge {
    if (lspBridge) return lspBridge;

    const basePath = getBasePath();
    const registry = new ServerRegistry();
    const rootUri = `file://${basePath}`;

    lspManager = new LspServerManager(registry, rootUri);
    const db = storeRef.current.getDb();
    const cache = new LspCache(db);
    const diagnostics = new LspDiagnosticsCollector();

    lspBridge = new LspBridge(lspManager, cache, diagnostics, basePath);

    // Auto-prune stale cache entries (> 7 days) on bridge initialization
    try {
      cache.prune();
    } catch (err) {
      logger.debug("codeGraph:cachePruneFailure", { error: err instanceof Error ? err.message : String(err) });
      // Non-critical — ignore prune errors
    }

    return lspBridge;
  }

  // POST /code/lsp/definition
  router.post("/lsp/definition", async (req, res, next) => {
    try {
      const { file, line, character } = LspPositionSchema.parse(req.body);
      const bridge = getOrCreateLspBridge();
      const result = await bridge.goToDefinition(file, line, character);
      res.json({
        ok: true,
        definitions: result.map(d => ({
          ...d,
          hint: `Read lines ${d.startLine}-${d.endLine} of ${d.file}`,
        })),
        estimatedTokens: estimateTokens(JSON.stringify(result)),
      });
    } catch (err) { next(err); }
  });

  // POST /code/lsp/references
  router.post("/lsp/references", async (req, res, next) => {
    try {
      const { file, line, character } = LspPositionSchema.parse(req.body);
      const bridge = getOrCreateLspBridge();
      const result = await bridge.findReferences(file, line, character);
      const byFile: Record<string, number> = {};
      for (const ref of result) byFile[ref.file] = (byFile[ref.file] ?? 0) + 1;
      res.json({ ok: true, totalReferences: result.length, references: result, byFile });
    } catch (err) { next(err); }
  });

  // POST /code/lsp/hover
  router.post("/lsp/hover", async (req, res, next) => {
    try {
      const { file, line, character } = LspPositionSchema.parse(req.body);
      const bridge = getOrCreateLspBridge();
      const result = await bridge.hover(file, line, character);
      res.json({ ok: true, hover: result });
    } catch (err) { next(err); }
  });

  // POST /code/lsp/rename
  router.post("/lsp/rename", async (req, res, next) => {
    try {
      const { file, line, character, newName } = LspRenameSchema.parse(req.body);
      const bridge = getOrCreateLspBridge();
      const result = await bridge.rename(file, line, character, newName);
      res.json({ ok: true, edit: result });
    } catch (err) { next(err); }
  });

  // POST /code/lsp/call-hierarchy
  router.post("/lsp/call-hierarchy", async (req, res, next) => {
    try {
      const { file, line, character, direction } = LspCallHierarchySchema.parse(req.body);
      const bridge = getOrCreateLspBridge();
      const result = direction === "incoming"
        ? await bridge.callHierarchyIncoming(file, line, character)
        : await bridge.callHierarchyOutgoing(file, line, character);
      res.json({ ok: true, direction, items: result });
    } catch (err) { next(err); }
  });

  // GET /code/lsp/diagnostics?file=...
  router.get("/lsp/diagnostics", async (req, res, next) => {
    try {
      const file = z.string().min(1).parse(req.query.file);
      const bridge = getOrCreateLspBridge();
      const result = await bridge.getDiagnostics(file);
      res.json({ ok: true, file, diagnostics: result });
    } catch (err) { next(err); }
  });

  // GET /code/lsp/symbols?file=...
  router.get("/lsp/symbols", async (req, res, next) => {
    try {
      const file = z.string().min(1).parse(req.query.file);
      const bridge = getOrCreateLspBridge();
      const result = await bridge.getDocumentSymbols(file);
      res.json({ ok: true, file, symbols: result });
    } catch (err) { next(err); }
  });

  // GET /code/lsp/languages
  router.get("/lsp/languages", (_req, res, next) => {
    try {
      const basePath = getBasePath();
      const registry = new ServerRegistry();
      const detected = detectProjectLanguages(basePath, registry);
      res.json({
        ok: true,
        detected: detected.map(d => ({
          ...d,
          serverCommand: registry.getConfigForLanguage(d.languageId)?.command,
        })),
        supportedLanguages: registry.getAllConfigs().map(c => c.languageId),
      });
    } catch (err) { next(err); }
  });

  // GET /code/lsp/status — also triggers lazy bridge initialization (warm-up)
  router.get("/lsp/status", (_req, res) => {
    getOrCreateLspBridge();
    const statuses: Record<string, string> = {};
    if (lspManager) {
      for (const [lang, state] of lspManager.getStatus()) {
        statuses[lang] = state.status;
      }
    }
    res.json({
      ok: true,
      bridgeInitialized: lspBridge !== null,
      servers: statuses,
    });
  });

  return router;
}
