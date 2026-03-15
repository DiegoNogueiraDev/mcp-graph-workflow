import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";

export function createStatsRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      res.json(storeRef.current.getStats());
    } catch (err) {
      next(err);
    }
  });

  return router;
}
