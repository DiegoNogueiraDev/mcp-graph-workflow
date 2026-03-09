import { Router } from "express";
import { z } from "zod/v4";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { validateBody } from "../middleware/validate.js";

const InitProjectBodySchema = z.object({
  name: z.string().min(1).optional(),
});

export function createProjectRouter(store: SqliteStore): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      const project = store.getProject();
      if (!project) {
        res.status(404).json({ error: "No project initialized" });
        return;
      }
      res.json(project);
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/init",
    validateBody(InitProjectBodySchema),
    (req, res, next) => {
      try {
        const project = store.initProject(req.body.name);
        res.status(201).json(project);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
