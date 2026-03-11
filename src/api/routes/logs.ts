import { Router } from "express";
import { getLogBuffer, clearLogBuffer } from "../../core/utils/logger.js";

export function createLogsRouter(): Router {
  const router = Router();

  /**
   * GET /logs
   * Returns buffered log entries with optional filters.
   * Query params: level, since (id), search (text)
   */
  router.get("/", (req, res) => {
    let logs = getLogBuffer();

    const { level, since, search } = req.query;

    if (typeof level === "string" && level.length > 0) {
      logs = logs.filter((entry) => entry.level === level);
    }

    if (typeof since === "string" && since.length > 0) {
      const sinceId = Number(since);
      if (!Number.isNaN(sinceId)) {
        logs = logs.filter((entry) => entry.id > sinceId);
      }
    }

    if (typeof search === "string" && search.length > 0) {
      const term = search.toLowerCase();
      logs = logs.filter((entry) => entry.message.toLowerCase().includes(term));
    }

    res.json({ logs, total: logs.length });
  });

  /**
   * DELETE /logs
   * Clears the in-memory log buffer.
   */
  router.delete("/", (_req, res) => {
    clearLogBuffer();
    res.status(204).end();
  });

  return router;
}
