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
import { prepareSifGeneration, finalizeSifGeneration } from "../../core/siebel/sif-generator.js";
import { listTemplates } from "../../core/siebel/sif-templates.js";
import { readFileContent, isSupportedFormat } from "../../core/parser/file-reader.js";
import { chunkText } from "../../core/rag/chunk-text.js";
import { STORE_DIR } from "../../core/utils/constants.js";
import { generateSiebelErd } from "../../core/siebel/object-erd.js";
import { getSiebelBestPractices, getBestPracticesByCategory } from "../../core/siebel/best-practices.js";
import { enrichSifContext } from "../../core/siebel/context-enrichment.js";
import { reviewSiebelCode } from "../../core/siebel/code-review.js";
import { checkSiebelReady } from "../../core/siebel/definition-of-ready.js";
import { logger } from "../../core/utils/logger.js";
import multer from "multer";
import path from "node:path";
import { unlink } from "node:fs/promises";

const siebelUpload = multer({
  dest: "/tmp/mcp-graph-siebel-uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
});

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
        objects: parseResult.objects,
        dependencies: parseResult.dependencies,
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

        // Store raw SIF content for later retrieval via GET /graph
        knowledgeStore.deleteBySource("siebel_sif_raw", `siebel_sif_raw:${fileName}`);
        knowledgeStore.insert({
          sourceType: "siebel_sif_raw",
          sourceId: `siebel_sif_raw:${fileName}`,
          title: `Raw SIF: ${fileName}`,
          content: content,
          metadata: { fileName, importedAt: new Date().toISOString() },
        });
      } catch (err) {
        logger.debug("siebel:knowledgeStoreInsertFailure", { error: err instanceof Error ? err.message : String(err) });
        // Non-fatal
      }

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/siebel/graph — Return full Siebel graph (objects + dependencies) from stored raw SIF
   */
  router.get("/graph", (req, res, next) => {
    try {
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());

      // Find the latest stored raw SIF content
      const rawDocs = knowledgeStore.list({ sourceType: "siebel_sif_raw", limit: 1 });

      if (rawDocs.length === 0) {
        res.json({ objects: [], dependencies: [], metadata: null });
        return;
      }

      const rawDoc = rawDocs[0];
      const fileName = (rawDoc.metadata?.fileName as string) ?? "unknown.sif";
      const parseResult = parseSifContent(rawDoc.content, fileName);

      res.json({
        objects: parseResult.objects,
        dependencies: parseResult.dependencies,
        metadata: parseResult.metadata,
      });
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

  /**
   * GET /api/v1/siebel/generate/templates — List available SIF templates
   */
  router.get("/generate/templates", (_req, res) => {
    const templates = listTemplates();
    res.json({
      templates: templates.map((t) => ({
        type: t.type,
        xmlTag: t.xmlTag,
        requiredAttrs: t.requiredAttrs,
        optionalAttrs: t.optionalAttrs,
        childTags: t.childTags,
      })),
    });
  });

  /**
   * POST /api/v1/siebel/generate/prepare — Prepare SIF generation context + prompt
   * Body: { description: string, objectTypes: string[], basedOnProject?: string, properties?: Record }
   */
  router.post("/generate/prepare", (req, res, next) => {
    try {
      const { description, objectTypes, basedOnProject, properties } = req.body;

      if (!description || !objectTypes || objectTypes.length === 0) {
        res.status(400).json({ error: "description and objectTypes are required" });
        return;
      }

      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
      const context = prepareSifGeneration(knowledgeStore, {
        description,
        objectTypes,
        basedOnProject,
        properties,
      });

      res.json({
        prompt: context.prompt,
        templates: context.templates.map((t) => t.type),
        existingObjectsCount: context.existingObjects.length,
        relatedDocsCount: context.relatedDocs.length,
        validationRules: context.validationRules,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/siebel/generate/finalize — Validate generated SIF XML and index
   * Body: { generatedXml: string, description?: string, objectTypes?: string[] }
   */
  router.post("/generate/finalize", (req, res, next) => {
    try {
      const { generatedXml, description = "SIF generation", objectTypes = [] } = req.body;

      if (!generatedXml) {
        res.status(400).json({ error: "generatedXml is required" });
        return;
      }

      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
      const result = finalizeSifGeneration(knowledgeStore, generatedXml, {
        description,
        objectTypes,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/siebel/upload-docs — Upload documentation as Siebel context
   * Multipart: file field, supports PDF, HTML, TXT, MD, DOC, DOCX
   */
  router.post("/upload-docs", siebelUpload.single("file"), async (req, res, next) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded. Send a file with field name 'file'." });
      return;
    }

    try {
      if (!isSupportedFormat(file.originalname)) {
        res.status(400).json({
          error: `Unsupported file format. Supported: .md, .txt, .pdf, .html, .htm, .doc, .docx`,
        });
        return;
      }

      const fileResult = await readFileContent(file.path);
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());

      const sourceId = `siebel_docs:${file.originalname}`;
      knowledgeStore.deleteBySource("siebel_docs", sourceId);

      const chunks = chunkText(fileResult.text);
      let indexed = 0;

      for (const chunk of chunks) {
        knowledgeStore.insert({
          sourceType: "siebel_docs",
          sourceId,
          title: `${file.originalname} [${chunk.index + 1}/${chunks.length}]`,
          content: chunk.content,
          chunkIndex: chunk.index,
          metadata: {
            fileName: file.originalname,
            format: fileResult.format,
            sizeBytes: fileResult.sizeBytes,
          },
        });
        indexed++;
      }

      logger.info("Siebel docs uploaded and indexed", {
        fileName: file.originalname,
        chunks: String(indexed),
      });

      res.status(201).json({
        ok: true,
        fileName: file.originalname,
        format: fileResult.format,
        chunksIndexed: indexed,
        textLength: fileResult.text.length,
      });
    } catch (err) {
      next(err);
    } finally {
      try {
        await unlink(file.path);
      } catch (err) {
        logger.debug("siebel:fileCleanupFailure", { error: err instanceof Error ? err.message : String(err) });
        // Cleanup failure is non-fatal
      }
    }
  });

  /**
   * GET /api/v1/siebel/erd — Generate ER diagram from repository objects
   * Query: project? (filter by project)
   */
  router.get("/erd", (req, res, next) => {
    try {
      const { project } = req.query as Record<string, string>;
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
      const rawDocs = knowledgeStore.list({ sourceType: "siebel_sif_raw", limit: 100 });

      const allObjects = rawDocs.flatMap((doc) => {
        try { return parseSifContent(doc.content, doc.title).objects; } catch { return []; }
      });

      const erd = generateSiebelErd(allObjects, project || undefined);
      res.json(erd);
    } catch (err) { next(err); }
  });

  /**
   * GET /api/v1/siebel/best-practices — List best practice rules
   * Query: category? (filter by category)
   */
  router.get("/best-practices", (req, res) => {
    const { category } = req.query as Record<string, string>;
    if (category) {
      const byCategory = getBestPracticesByCategory();
      res.json({ rules: byCategory[category] ?? [], category });
    } else {
      res.json({ rules: getSiebelBestPractices(), total: getSiebelBestPractices().length });
    }
  });

  /**
   * POST /api/v1/siebel/review — Run code review on SIF content
   * Body: { content: string, prefix?: string }
   */
  router.post("/review", (req, res, next) => {
    try {
      const { content, prefix = "CX_" } = req.body;
      if (!content) { res.status(400).json({ error: "content is required" }); return; }

      const parseResult = parseSifContent(content, "review.sif");
      const review = reviewSiebelCode(parseResult.objects, { prefix });
      res.json(review);
    } catch (err) { next(err); }
  });

  /**
   * POST /api/v1/siebel/ready-check — Run definition of ready checks
   * Body: { content: string, prefix?: string, currentUser?: string }
   */
  router.post("/ready-check", (req, res, next) => {
    try {
      const { content, prefix = "CX_", currentUser } = req.body;
      if (!content) { res.status(400).json({ error: "content is required" }); return; }

      const parseResult = parseSifContent(content, "ready-check.sif");
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
      const repoDocs = knowledgeStore.list({ sourceType: "siebel_sif_raw", limit: 50 });
      const repoObjects = repoDocs.flatMap((d) => {
        try { return parseSifContent(d.content, d.title).objects; } catch { return []; }
      });

      const result = checkSiebelReady({
        targetObjects: parseResult.objects,
        repository: repoObjects,
        prefix,
        currentUser,
      });
      res.json(result);
    } catch (err) { next(err); }
  });

  /**
   * GET /api/v1/siebel/metrics — Repository metrics and statistics
   */
  router.get("/metrics", (req, res, next) => {
    try {
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
      const rawDocs = knowledgeStore.list({ sourceType: "siebel_sif_raw", limit: 100 });

      const allObjects = rawDocs.flatMap((doc) => {
        try { return parseSifContent(doc.content, doc.title).objects; } catch { return []; }
      });

      // Type distribution
      const typeCounts: Record<string, number> = {};
      for (const obj of allObjects) {
        typeCounts[obj.type] = (typeCounts[obj.type] ?? 0) + 1;
      }

      // Project distribution
      const projectCounts: Record<string, number> = {};
      for (const obj of allObjects) {
        const proj = obj.project ?? "unknown";
        projectCounts[proj] = (projectCounts[proj] ?? 0) + 1;
      }

      // Script coverage
      const scriptableTypes = allObjects.filter((o) => ["applet", "business_component", "business_service"].includes(o.type));
      const withScripts = scriptableTypes.filter((o) => o.children.some((c) => c.type === "escript"));

      // Locked objects
      const locked = allObjects.filter((o) =>
        o.properties.some((p) => p.name === "OBJECT_LOCKED" && p.value === "Y"),
      );

      res.json({
        totalObjects: allObjects.length,
        totalSifs: rawDocs.length,
        typeDistribution: typeCounts,
        projectDistribution: projectCounts,
        scriptCoverage: {
          scriptableObjects: scriptableTypes.length,
          withScripts: withScripts.length,
          percentage: scriptableTypes.length > 0 ? Math.round((withScripts.length / scriptableTypes.length) * 100) : 0,
        },
        lockedObjects: locked.map((o) => ({
          name: o.name,
          type: o.type,
          lockedBy: o.properties.find((p) => p.name === "LOCKED_BY")?.value ?? "unknown",
        })),
      });
    } catch (err) { next(err); }
  });

  /**
   * POST /api/v1/siebel/enrich — Enrich SIF context (summary, deps, usage)
   * Body: { content: string }
   */
  router.post("/enrich", (req, res, next) => {
    try {
      const { content } = req.body;
      if (!content) { res.status(400).json({ error: "content is required" }); return; }

      const parseResult = parseSifContent(content, "enrich.sif");
      const enrichment = enrichSifContext({
        objects: parseResult.objects,
        dependencies: parseResult.dependencies,
      });
      res.json(enrichment);
    } catch (err) { next(err); }
  });

  return router;
}
