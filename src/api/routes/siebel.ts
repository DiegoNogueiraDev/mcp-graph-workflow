/**
 * Siebel API Router — REST endpoints for Siebel CRM integration.
 */

import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { parseSifContent } from "../../core/siebel/sif-parser.js";
import { convertSifToGraph } from "../../core/siebel/sif-to-graph.js";
import { analyzeSiebelImpact, detectCircularDeps } from "../../core/siebel/dependency-analyzer.js";
import { indexSifContent } from "../../core/rag/siebel-indexer.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import {
  loadSiebelConfig,
  addEnvironment,
  removeEnvironment,
} from "../../core/siebel/siebel-config.js";
import { STORE_DIR } from "../../core/utils/constants.js";
import path from "node:path";

export function createSiebelRouter(storeRef: StoreRef, getBasePath: () => string): Router {
  const router = Router();

  /**
   * POST /api/v1/siebel/import — Import SIF content
   * Body: { content: string, fileName?: string, mapToGraph?: boolean }
   */
  router.post("/import", (req, res, next) => {
    try {
      const { content, fileName = "api-import.sif", mapToGraph = true } = req.body;

      if (!content) {
        res.status(400).json({ error: "content is required" });
        return;
      }

      const parseResult = parseSifContent(content, fileName);

      const result: Record<string, unknown> = {
        metadata: parseResult.metadata,
        objectCount: parseResult.objects.length,
        dependencyCount: parseResult.dependencies.length,
      };

      if (mapToGraph) {
        const { nodes, edges } = convertSifToGraph(parseResult);
        storeRef.current.bulkInsert(nodes, edges);
        result.nodesCreated = nodes.length;
        result.edgesCreated = edges.length;
      }

      // Index into knowledge store
      try {
        const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
        const indexResult = indexSifContent(knowledgeStore, parseResult);
        result.documentsIndexed = indexResult.documentsIndexed;
      } catch {
        // Non-fatal
      }

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/siebel/objects — List Siebel objects from knowledge store
   * Query: type? (filter by Siebel object type), limit?, offset?
   */
  router.get("/objects", (req, res, next) => {
    try {
      const { type, limit = "50", offset = "0" } = req.query as Record<string, string>;
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());

      const docs = knowledgeStore.search("Siebel", parseInt(limit) + parseInt(offset) + 50);
      let siebelDocs = docs.filter(
        (d) => d.sourceType === "siebel_sif" || d.sourceType === "siebel_composer",
      );

      if (type) {
        siebelDocs = siebelDocs.filter((d) => d.metadata?.siebelType === type);
      }

      const paged = siebelDocs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      res.json({
        objects: paged.map((d) => ({
          title: d.title,
          sourceType: d.sourceType,
          siebelType: d.metadata?.siebelType,
          siebelProject: d.metadata?.siebelProject,
          contentPreview: d.content.slice(0, 200),
        })),
        total: siebelDocs.length,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/siebel/analyze/impact — Impact analysis for a Siebel object
   * Body: { content: string, objectName: string, objectType: string }
   */
  router.post("/analyze/impact", (req, res, next) => {
    try {
      const { content, objectName, objectType } = req.body;

      if (!content || !objectName || !objectType) {
        res.status(400).json({ error: "content, objectName, and objectType are required" });
        return;
      }

      const parseResult = parseSifContent(content, "impact-analysis.sif");
      const impact = analyzeSiebelImpact(parseResult.dependencies, {
        name: objectName,
        type: objectType,
      });

      res.json(impact);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/siebel/analyze/circular — Detect circular dependencies
   * Body: { content: string }
   */
  router.post("/analyze/circular", (req, res, next) => {
    try {
      const { content } = req.body;

      if (!content) {
        res.status(400).json({ error: "content is required" });
        return;
      }

      const parseResult = parseSifContent(content, "circular-check.sif");
      const cycles = detectCircularDeps(parseResult.dependencies);

      res.json({ cyclesFound: cycles.length, cycles });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/siebel/environments — List Siebel environments
   */
  router.get("/environments", (_req, res, next) => {
    try {
      const graphDir = path.join(getBasePath(), STORE_DIR);
      const envs = loadSiebelConfig(graphDir);
      res.json({ environments: envs, count: envs.length });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/siebel/environments — Add a Siebel environment
   * Body: SiebelEnvironment
   */
  router.post("/environments", (req, res, next) => {
    try {
      const graphDir = path.join(getBasePath(), STORE_DIR);
      const envs = addEnvironment(graphDir, req.body);
      res.status(201).json({ environments: envs });
    } catch (err) {
      next(err);
    }
  });

  /**
   * DELETE /api/v1/siebel/environments/:name — Remove a Siebel environment
   */
  router.delete("/environments/:name", (req, res, next) => {
    try {
      const graphDir = path.join(getBasePath(), STORE_DIR);
      const envs = removeEnvironment(graphDir, req.params.name);
      res.json({ environments: envs });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
