import { Router } from "express";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

export function createStatsRouter(store: SqliteStore): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      res.json(store.getStats());
    } catch (err) {
      next(err);
    }
  });

  return router;
}
