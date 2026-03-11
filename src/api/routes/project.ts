import { Router } from "express";
import { z } from "zod/v4";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { validateBody } from "../middleware/validate.js";

const InitProjectBodySchema = z.object({
  name: z.string().min(1).optional(),
});

export function createProjectRouter(store: SqliteStore): Router {
  const router = Router();

  // GET /project — current active project
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

  // POST /project/init — initialize a new project
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

  // GET /project/active — alias for GET /project
  router.get("/active", (_req, res, next) => {
    try {
      const project = store.getActiveProject();
      if (!project) {
        res.status(404).json({ error: "No active project" });
        return;
      }
      res.json(project);
    } catch (err) {
      next(err);
    }
  });

  // GET /project/list — list all projects
  router.get("/list", (_req, res, next) => {
    try {
      const projects = store.listProjects();
      res.json({ total: projects.length, projects });
    } catch (err) {
      next(err);
    }
  });

  // POST /project/:id/activate — switch active project
  router.post("/:id/activate", (req, res, next) => {
    try {
      store.activateProject(req.params.id);
      const project = store.getProject();
      res.json({ ok: true, project });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
