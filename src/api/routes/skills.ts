import { Router } from "express";
import { scanSkills } from "../../core/insights/skill-recommender.js";

export function createSkillsRouter(basePath: string): Router {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const skills = await scanSkills(basePath);
      res.json(skills);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
