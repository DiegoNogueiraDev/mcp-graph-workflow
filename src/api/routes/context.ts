import { Router } from "express";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";

export function createContextRouter(store: SqliteStore): Router {
  const router = Router();

  router.get("/preview", (req, res, next) => {
    try {
      const nodeId = req.query.nodeId as string | undefined;
      if (!nodeId) {
        res.status(400).json({ error: "Missing 'nodeId' query parameter" });
        return;
      }

      const context = buildTaskContext(store, nodeId);
      if (!context) {
        res.status(404).json({ error: `Node not found: ${nodeId}` });
        return;
      }

      res.json(context);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
