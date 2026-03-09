import { Router } from "express";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { getIntegrationsStatus } from "../../core/integrations/tool-status.js";
import { listSerenaMemories, readSerenaMemory, readAllSerenaMemories } from "../../core/integrations/serena-reader.js";

export function createIntegrationsRouter(store: SqliteStore, basePath: string): Router {
  const router = Router();

  router.get("/status", async (_req, res, next) => {
    try {
      const status = await getIntegrationsStatus(basePath);
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  router.get("/serena/memories", async (_req, res, next) => {
    try {
      const memories = await readAllSerenaMemories(basePath);
      res.json(memories);
    } catch (err) {
      next(err);
    }
  });

  router.get("/serena/memories/:name", async (req, res, next) => {
    try {
      const name = req.params.name as string;
      const memory = await readSerenaMemory(basePath, name);
      if (!memory) {
        res.status(404).json({ error: `Memory not found: ${name}` });
        return;
      }
      res.json(memory);
    } catch (err) {
      next(err);
    }
  });

  router.get("/gitnexus/url", async (_req, res, next) => {
    try {
      const status = await getIntegrationsStatus(basePath);
      if (!status.gitnexus.running) {
        res.status(503).json({
          error: "GitNexus is not running",
          instructions: "Run: gitnexus analyze && gitnexus serve",
        });
        return;
      }
      res.json({ url: status.gitnexus.url });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
