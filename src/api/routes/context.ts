import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { buildTaskContext } from "../../core/context/compact-context.js";

export function createContextRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/preview", (req, res, next) => {
    try {
      const nodeId = req.query.nodeId as string | undefined;
      if (!nodeId) {
        res.status(400).json({ error: "Missing 'nodeId' query parameter" });
        return;
      }

      const context = buildTaskContext(storeRef.current, nodeId);
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
