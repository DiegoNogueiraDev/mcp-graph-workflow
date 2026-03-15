import { Router } from "express";
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import { GraphEdgeSchema } from "../../schemas/edge.schema.js";
import { validateBody } from "../middleware/validate.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";

const CreateEdgeBodySchema = GraphEdgeSchema.omit({ id: true, createdAt: true }).extend({
  id: z.string().optional(),
});

export function createEdgesRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      res.json(storeRef.current.getAllEdges());
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/",
    validateBody(CreateEdgeBodySchema),
    (req, res, next) => {
      try {
        const edge = {
          ...req.body,
          id: req.body.id ?? generateId("edge"),
          createdAt: now(),
        };
        storeRef.current.insertEdge(edge);
        res.status(201).json(edge);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete("/:id", (req, res, next) => {
    try {
      const id = req.params.id as string;
      const deleted = storeRef.current.deleteEdge(id);
      if (!deleted) {
        res.status(404).json({ error: `Edge not found: ${id}` });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
