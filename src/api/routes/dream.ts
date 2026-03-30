import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { DreamEngine } from "../../core/dream/dream-engine.js";
import { DreamCycleConfigSchema } from "../../core/dream/dream-types.js";
import { getDreamCycle, listDreamCycles } from "../../core/dream/dream-store.js";
import { GraphEventBus } from "../../core/events/event-bus.js";

export function createDreamRouter(storeRef: StoreRef, eventBus?: GraphEventBus): Router {
  const router = Router();
  const bus = eventBus ?? new GraphEventBus();
  let engine: DreamEngine | null = null;

  function getEngine(): DreamEngine {
    if (!engine) {
      engine = new DreamEngine(storeRef.current.getDb(), bus);
    }
    return engine;
  }

  /**
   * POST /dream/cycle — Start a dream cycle.
   */
  router.post("/cycle", (req, res, next) => {
    try {
      const parseResult = DreamCycleConfigSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid config", details: parseResult.error.issues });
        return;
      }

      const dreamEngine = getEngine();
      const status = dreamEngine.getStatus();
      if (status.running) {
        res.status(409).json({ error: "A dream cycle is already running", cycleId: status.cycleId });
        return;
      }

      // Start cycle asynchronously
      let cycleId = "";
      dreamEngine.runCycle(parseResult.data).then((result) => {
        cycleId = result.id;
      }).catch(() => { /* error handled by engine + events */ });

      // Return immediately — the cycle runs in background
      // We need to give the engine a tick to set the cycleId
      setTimeout(() => {
        const currentStatus = dreamEngine.getStatus();
        res.status(202).json({ ok: true, cycleId: currentStatus.cycleId ?? cycleId });
      }, 10);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /dream/cycle/cancel — Cancel a running cycle.
   */
  router.post("/cycle/cancel", (_req, res, next) => {
    try {
      const dreamEngine = getEngine();
      dreamEngine.cancelCycle();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /dream/status — Current dream engine status.
   */
  router.get("/status", (_req, res, next) => {
    try {
      const dreamEngine = getEngine();
      res.json(dreamEngine.getStatus());
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /dream/history — List past dream cycles.
   */
  router.get("/history", (req, res, next) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const db = storeRef.current.getDb();
      const cycles = listDreamCycles(db, limit);
      res.json(cycles);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /dream/history/:id — Get a specific cycle result.
   */
  router.get("/history/:id", (req, res, next) => {
    try {
      const db = storeRef.current.getDb();
      const cycle = getDreamCycle(db, req.params.id);
      if (!cycle) {
        res.status(404).json({ error: `Dream cycle not found: ${req.params.id}` });
        return;
      }
      res.json(cycle);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /dream/preview — Dry-run preview.
   */
  router.get("/preview", async (_req, res, next) => {
    try {
      const dreamEngine = getEngine();
      const result = await dreamEngine.runCycle({ dryRun: true });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /dream/metrics — Aggregated metrics across all cycles.
   */
  router.get("/metrics", (_req, res, next) => {
    try {
      const db = storeRef.current.getDb();
      const cycles = listDreamCycles(db, 1000);
      const metrics = {
        totalCycles: cycles.length,
        totalPruned: cycles.reduce((s, c) => s + c.summary.totalPruned, 0),
        totalMerged: cycles.reduce((s, c) => s + c.summary.totalMerged, 0),
        totalAssociations: cycles.reduce((s, c) => s + c.summary.totalAssociations, 0),
        avgQualityImprovement: cycles.length > 0
          ? cycles.reduce((s, c) => s + (c.summary.avgQualityAfter - c.summary.avgQualityBefore), 0) / cycles.length
          : 0,
        totalFreedTokens: cycles.reduce((s, c) => s + c.summary.freedCapacityEstimate, 0),
      };
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
