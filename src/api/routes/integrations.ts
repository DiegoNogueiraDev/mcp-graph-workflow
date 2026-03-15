import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { getIntegrationsStatus } from "../../core/integrations/tool-status.js";
import { readSerenaMemory, readAllSerenaMemories } from "../../core/integrations/serena-reader.js";
import { buildEnrichedContext } from "../../core/integrations/enriched-context.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";

export function createIntegrationsRouter(storeRef: StoreRef, getBasePath: () => string): Router {
  const router = Router();

  router.get("/status", async (_req, res, next) => {
    try {
      const status = await getIntegrationsStatus(getBasePath());
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  router.get("/serena/memories", async (_req, res, next) => {
    try {
      const memories = await readAllSerenaMemories(getBasePath());
      res.json(memories);
    } catch (err) {
      next(err);
    }
  });

  router.get("/serena/memories/:name", async (req, res, next) => {
    try {
      const name = req.params.name as string;
      const memory = await readSerenaMemory(getBasePath(), name);
      if (!memory) {
        res.status(404).json({ error: `Memory not found: ${name}` });
        return;
      }
      res.json(memory);
    } catch (err) {
      next(err);
    }
  });

  router.get("/gitnexus/url", async (_req, res, next) => {
    try {
      const status = await getIntegrationsStatus(getBasePath());
      if (!status.gitnexus.running) {
        res.status(503).json({
          error: "GitNexus is not running",
          instructions: "Run: gitnexus analyze && gitnexus serve",
        });
        return;
      }
      res.json({ url: status.gitnexus.url });
    } catch (err) {
      next(err);
    }
  });

  // ── Enriched context (Serena + GitNexus combined) ──
  router.get("/enriched-context/:symbol", async (req, res, next) => {
    try {
      const symbol = req.params.symbol as string;
      const ctx = await buildEnrichedContext(symbol, getBasePath());
      res.json(ctx);
    } catch (err) {
      next(err);
    }
  });

  // ── Knowledge sync status ───────────────────────
  router.get("/knowledge-status", (_req, res, next) => {
    try {
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
      const sourceTypes = ["upload", "serena", "code_context", "docs", "web_capture"] as const;
      const statuses = sourceTypes.map((st) => ({
        source: st,
        documentCount: knowledgeStore.count(st),
      }));
      const total = knowledgeStore.count();
      res.json({ total, sources: statuses.filter((s) => s.documentCount > 0) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
