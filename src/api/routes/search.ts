import { Router } from "express";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

export function createSearchRouter(store: SqliteStore): Router {
  const router = Router();

  router.get("/", (req, res, next) => {
    try {
      const q = req.query.q as string | undefined;
      if (!q || q.trim().length === 0) {
        res.status(400).json({ error: "Query parameter 'q' is required" });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      if (isNaN(limit) || limit < 1) {
        res.status(400).json({ error: "Invalid limit parameter" });
        return;
      }

      const results = store.searchNodes(q, limit);
      res.json(results);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
