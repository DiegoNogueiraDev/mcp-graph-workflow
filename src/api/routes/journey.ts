import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import { JourneyStore } from "../../core/journey/journey-store.js";
import { validateBody } from "../middleware/validate.js";
import { GraphNotInitializedError } from "../../core/utils/errors.js";
import { STORE_DIR } from "../../core/utils/constants.js";

const JOURNEY_SCREENSHOTS_DIR = "journey-screenshots";

const CreateMapSchema = z.object({
  name: z.string().min(1),
  url: z.string().optional(),
  description: z.string().optional(),
});

const CreateScreenSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  screenshot: z.string().optional(),
  url: z.string().optional(),
  screenType: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().optional(),
    label: z.string().optional(),
    options: z.array(z.string()).optional(),
  })).optional(),
  ctas: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

const CreateEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
  type: z.string().optional(),
});

const ImportJourneySchema = z.object({
  journey: z.object({
    name: z.string().min(1),
    url: z.string().optional(),
    description: z.string().optional(),
  }),
  screens: z.array(z.object({
    id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    screenshot: z.string().optional(),
    url: z.string().optional(),
    screenType: z.string().optional(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean().optional(),
      label: z.string().optional(),
      options: z.array(z.string()).optional(),
    })).optional(),
    ctas: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
  edges: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    label: z.string().optional(),
    type: z.string().optional(),
  })),
  variants: z.record(z.string(), z.object({
    name: z.string(),
    description: z.string().optional(),
    path: z.array(z.string()),
  })).optional(),
});

function getJourneyStore(storeRef: StoreRef): JourneyStore {
  const store = storeRef.current;
  const project = store.getProject();
  if (!project) throw new GraphNotInitializedError();
  return new JourneyStore(store.getDb(), project.id);
}

export function createJourneyRouter(storeRef: StoreRef, getBasePath: () => string): Router {
  const router = Router();

  // ── List all journey maps ─────────────────────────

  router.get("/maps", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const maps = journeyStore.listMaps();
      res.json({ maps });
    } catch (err) {
      next(err);
    }
  });

  // ── Create a journey map ──────────────────────────

  router.post("/maps", validateBody(CreateMapSchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const input = req.body as z.infer<typeof CreateMapSchema>;
      const map = journeyStore.createMap(input);
      res.status(201).json(map);
    } catch (err) {
      next(err);
    }
  });

  // ── Get a journey map with screens and edges ──────

  router.get("/maps/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const map = journeyStore.getMap(req.params.id as string);
      if (!map) {
        res.status(404).json({ error: "Journey map not found" });
        return;
      }
      res.json(map);
    } catch (err) {
      next(err);
    }
  });

  // ── Delete a journey map ──────────────────────────

  router.delete("/maps/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const deleted = journeyStore.deleteMap(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ error: "Journey map not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // ── Add a screen to a map ─────────────────────────

  router.post("/maps/:id/screens", validateBody(CreateScreenSchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const input = req.body as z.infer<typeof CreateScreenSchema>;
      const screen = journeyStore.addScreen(req.params.id as string, input);
      res.status(201).json(screen);
    } catch (err) {
      next(err);
    }
  });

  // ── Update a screen ───────────────────────────────

  router.patch("/screens/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const updated = journeyStore.updateScreen(req.params.id as string, req.body);
      if (!updated) {
        res.status(404).json({ error: "Screen not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // ── Delete a screen ───────────────────────────────

  router.delete("/screens/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const deleted = journeyStore.deleteScreen(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ error: "Screen not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // ── Add an edge between screens ───────────────────

  router.post("/maps/:id/edges", validateBody(CreateEdgeSchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const input = req.body as z.infer<typeof CreateEdgeSchema>;
      const edge = journeyStore.addEdge(req.params.id as string, input);
      res.status(201).json(edge);
    } catch (err) {
      next(err);
    }
  });

  // ── Delete an edge ────────────────────────────────

  router.delete("/edges/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const deleted = journeyStore.deleteEdge(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ error: "Edge not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // ── Import a full journey map from JSON ───────────

  router.post("/maps/import", validateBody(ImportJourneySchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const data = req.body as z.infer<typeof ImportJourneySchema>;
      const result = journeyStore.importJourneyMap(data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── Serve screenshots ─────────────────────────────

  router.get("/screenshots/:mapId/:filename", (req, res, next) => {
    try {
      const filename = req.params.filename as string;
      // Prevent path traversal
      const safeName = path.basename(filename);
      if (safeName !== filename || filename.includes("..")) {
        res.status(400).json({ error: "Invalid filename" });
        return;
      }

      const basePath = getBasePath();
      const screenshotPath = path.join(basePath, STORE_DIR, JOURNEY_SCREENSHOTS_DIR, safeName);

      if (!fs.existsSync(screenshotPath)) {
        res.status(404).json({ error: "Screenshot not found" });
        return;
      }

      res.sendFile(screenshotPath);
    } catch (err) {
      next(err);
    }
  });

  // ── List available screenshots ────────────────────

  router.get("/screenshots", (req, res, next) => {
    try {
      const basePath = getBasePath();
      const dir = path.join(basePath, STORE_DIR, JOURNEY_SCREENSHOTS_DIR);

      if (!fs.existsSync(dir)) {
        res.json({ files: [] });
        return;
      }

      const files = fs.readdirSync(dir)
        .filter((f) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f))
        .map((f) => ({
          name: f,
          size: fs.statSync(path.join(dir, f)).size,
          url: `/api/v1/journey/screenshots/_/${f}`,
        }));

      res.json({ files });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
