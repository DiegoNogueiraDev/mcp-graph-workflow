/**
 * Translation API routes — analyze, create jobs, prepare, finalize, stats.
 */

import { Router } from "express";
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import type { GraphEventBus } from "../../core/events/event-bus.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { TranslationOrchestrator } from "../../core/translation/translation-orchestrator.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { CodeStore } from "../../core/code/code-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { logger } from "../../core/utils/logger.js";

const AnalyzeSchema = z.object({
  code: z.string().min(1),
  languageHint: z.string().optional(),
  targetLanguage: z.string().optional(),
});

const CreateJobSchema = z.object({
  sourceCode: z.string().min(1),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string().min(1),
  scope: z.enum(["snippet", "function", "module"]).optional().default("snippet"),
});

const FinalizeSchema = z.object({
  generatedCode: z.string(),
});

export function createTranslationRouter(storeRef: StoreRef, eventBus?: GraphEventBus): Router {
  const router = Router();

  let _cachedDb: unknown = null;
  let _store: TranslationStore | null = null;
  let _registry: ConstructRegistry | null = null;
  let _orchestrator: TranslationOrchestrator | null = null;

  function getOrchestrator(): TranslationOrchestrator {
    const db = storeRef.current.getDb();
    if (db !== _cachedDb) {
      _cachedDb = db;
      _registry = new ConstructRegistry(db);
      loadAndSeedRegistry(_registry);
      _store = new TranslationStore(db);
      const codeStore = new CodeStore(db);
      _orchestrator = new TranslationOrchestrator(_registry, _store, codeStore);
    }
    return _orchestrator as TranslationOrchestrator;
  }

  function getStore(): TranslationStore {
    getOrchestrator(); // ensure initialized
    return _store as TranslationStore;
  }

  function getKnowledgeStore(): KnowledgeStore {
    const db = storeRef.current.getDb();
    return new KnowledgeStore(db);
  }

  function requireProjectId(): string {
    const id = storeRef.current.getProject()?.id;
    if (!id) throw new Error("NO_ACTIVE_PROJECT");
    return id;
  }

  /** Map known error messages to HTTP status codes */
  function errorStatus(err: unknown): number {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "NO_ACTIVE_PROJECT") return 409;
    if (msg.includes("not found") || msg.includes("Not found")) return 404;
    return 500;
  }

  /** POST /analyze — analyze source code */
  router.post("/analyze", (req, res) => {
    try {
      const parsed = AnalyzeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
        return;
      }

      const { code, languageHint, targetLanguage } = parsed.data;
      const analysis = getOrchestrator().analyzeSource(code, { languageHint, targetLanguage });
      eventBus?.emit({
        type: "translation:analyzed",
        timestamp: new Date().toISOString(),
        payload: { constructCount: analysis.totalConstructs, complexity: analysis.complexityScore },
      });
      res.json(analysis);
    } catch (err) {
      logger.error("Translation analyze failed", { error: err });
      res.status(500).json({ error: "Analysis failed" });
    }
  });

  /** POST /jobs — create a translation job (prepare) */
  router.post("/jobs", (req, res) => {
    try {
      const parsed = CreateJobSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
        return;
      }

      const { sourceCode, sourceLanguage, targetLanguage, scope } = parsed.data;
      const projectId = requireProjectId();
      const result = getOrchestrator().prepareTranslation({
        projectId,
        sourceCode,
        sourceLanguage,
        targetLanguage,
        scope,
      });

      eventBus?.emit({ type: "translation:job_created", timestamp: new Date().toISOString(), payload: { jobId: result.jobId, targetLanguage, scope } });
      res.status(201).json(result);
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation job creation failed", { error: err });
      eventBus?.emit({ type: "translation:error", timestamp: new Date().toISOString(), payload: { error: String(err) } });
      res.status(status).json({ error: err instanceof Error ? err.message : "Job creation failed" });
    }
  });

  /** GET /jobs — list translation jobs */
  router.get("/jobs", (_req, res) => {
    try {
      const projectId = requireProjectId();
      const jobs = getStore().listJobs(projectId);
      res.json({ jobs });
    } catch (err) {
      logger.error("Translation list failed", { error: err });
      res.status(errorStatus(err)).json({ error: err instanceof Error ? err.message : "List failed" });
    }
  });

  /** GET /jobs/:id — get a specific job */
  router.get("/jobs/:id", (req, res) => {
    try {
      const job = getStore().getJob(req.params.id);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json(job);
    } catch (err) {
      logger.error("Translation get failed", { error: err });
      res.status(500).json({ error: "Get failed" });
    }
  });

  /** POST /jobs/:id/finalize — finalize with generated code */
  router.post("/jobs/:id/finalize", (req, res) => {
    try {
      const parsed = FinalizeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
        return;
      }

      const result = getOrchestrator().finalizeTranslation(req.params.id, parsed.data.generatedCode);
      eventBus?.emit({ type: "translation:finalized", timestamp: new Date().toISOString(), payload: { jobId: req.params.id, confidence: result.evidence?.confidenceScore } });
      res.json(result);
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation finalize failed", { error: err });
      eventBus?.emit({ type: "translation:error", timestamp: new Date().toISOString(), payload: { jobId: req.params.id, error: String(err) } });
      res.status(status).json({ error: err instanceof Error ? err.message : "Finalize failed" });
    }
  });

  /** DELETE /jobs/:id — delete a job */
  router.delete("/jobs/:id", (req, res) => {
    try {
      const deleted = getStore().deleteJob(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      logger.error("Translation delete failed", { error: err });
      res.status(errorStatus(err)).json({ error: err instanceof Error ? err.message : "Delete failed" });
    }
  });

  /** GET /stats — translation statistics */
  router.get("/stats", (_req, res) => {
    try {
      const projectId = requireProjectId();
      const jobs = getStore().listJobs(projectId);
      const done = jobs.filter((j) => j.status === "done");
      const failed = jobs.filter((j) => j.status === "failed");
      const avgConfidence = done.length > 0
        ? done.reduce((sum, j) => sum + (j.confidenceScore ?? 0), 0) / done.length
        : 0;

      res.json({
        totalJobs: jobs.length,
        done: done.length,
        failed: failed.length,
        pending: jobs.length - done.length - failed.length,
        avgConfidence,
      });
    } catch (err) {
      logger.error("Translation stats failed", { error: err });
      res.status(errorStatus(err)).json({ error: err instanceof Error ? err.message : "Stats failed" });
    }
  });

  /** GET /knowledge — stats + entries from translation_evidence */
  router.get("/knowledge", (_req, res) => {
    try {
      requireProjectId();
      const ks = getKnowledgeStore();

      // Get all translation evidence documents
      const docs = ks.list({ sourceType: "translation_evidence" });

      // Aggregate stats
      const byPair: Record<string, number> = {};
      let totalConfidence = 0;
      let confidenceCount = 0;

      for (const doc of docs) {
        const meta = doc.metadata as Record<string, unknown> | undefined;
        if (meta) {
          const src = (meta.sourceLanguage as string) ?? "unknown";
          const tgt = (meta.targetLanguage as string) ?? "unknown";
          const key = `${src} → ${tgt}`;
          byPair[key] = (byPair[key] ?? 0) + 1;
          if (typeof meta.confidenceScore === "number") {
            totalConfidence += meta.confidenceScore;
            confidenceCount++;
          }
        }
      }

      res.json({
        totalDocuments: docs.length,
        byLanguagePair: Object.entries(byPair).map(([pair, count]) => ({ pair, count })),
        avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        recentEntries: docs.slice(0, 20).map(d => ({
          id: d.id,
          title: d.title,
          sourceType: d.sourceType,
          metadata: d.metadata,
          createdAt: d.createdAt,
        })),
      });
    } catch (err) {
      logger.error("Translation knowledge failed", { error: err });
      res.status(errorStatus(err)).json({ error: err instanceof Error ? err.message : "Knowledge failed" });
    }
  });

  /** GET /knowledge/search — FTS search over translation evidence */
  router.get("/knowledge/search", (req, res) => {
    try {
      requireProjectId();
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        res.status(400).json({ error: "Query parameter 'q' is required" });
        return;
      }

      const ks = getKnowledgeStore();
      const allResults = ks.search(query, 100);
      // Filter to translation_evidence only
      const results = allResults
        .filter(r => r.sourceType === "translation_evidence")
        .slice(0, 20);

      res.json({
        query,
        results: results.map(r => ({
          id: r.id,
          title: r.title,
          snippet: r.content?.substring(0, 200),
          metadata: r.metadata,
          score: r.score,
          createdAt: r.createdAt,
        })),
      });
    } catch (err) {
      logger.error("Translation knowledge search failed", { error: err });
      res.status(errorStatus(err)).json({ error: err instanceof Error ? err.message : "Search failed" });
    }
  });

  return router;
}
