import { Router } from "express";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { detectBottlenecks } from "../../core/insights/bottleneck-detector.js";
import { scanSkills, recommendSkills } from "../../core/insights/skill-recommender.js";
import { calculateMetrics } from "../../core/insights/metrics-calculator.js";

export function createInsightsRouter(store: SqliteStore, basePath: string): Router {
  const router = Router();

  router.get("/bottlenecks", (_req, res, next) => {
    try {
      const doc = store.toGraphDocument();
      const report = detectBottlenecks(doc);
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  router.get("/recommendations", async (_req, res, next) => {
    try {
      const doc = store.toGraphDocument();
      const skills = await scanSkills(basePath);
      const recommendations = recommendSkills(doc, skills);
      res.json({ recommendations });
    } catch (err) {
      next(err);
    }
  });

  router.get("/metrics", (_req, res, next) => {
    try {
      const doc = store.toGraphDocument();
      const metrics = calculateMetrics(doc);
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
