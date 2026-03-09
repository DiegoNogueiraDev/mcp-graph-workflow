import { Router } from "express";
import { z } from "zod/v4";
import { validateBody } from "../middleware/validate.js";
import { captureWebPage } from "../../core/capture/web-capture.js";
import { logger } from "../../core/utils/logger.js";

const CaptureRequestSchema = z.object({
  url: z.url("url must be a valid URL"),
  selector: z.string().optional(),
  timeout: z.number().int().positive().max(60_000).optional(),
  waitForSelector: z.string().optional(),
});

export function createCaptureRouter(): Router {
  const router = Router();

  /**
   * POST /capture
   * Capture a web page and extract structured content.
   */
  router.post("/", validateBody(CaptureRequestSchema), async (req, res, next) => {
    try {
      const { url, selector, timeout, waitForSelector } = req.body as z.infer<typeof CaptureRequestSchema>;

      logger.info("Capture request received", { url, selector });

      const result = await captureWebPage(url, { selector, timeout, waitForSelector });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
