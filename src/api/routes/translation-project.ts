/**
 * Translation Project API routes — upload ZIP, manage projects, prepare/finalize files, download.
 */

import { Router } from "express";
import { z } from "zod/v4";
import multer from "multer";
import path from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import type { StoreRef } from "../../core/store/store-manager.js";
import type { GraphEventBus } from "../../core/events/event-bus.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { TranslationOrchestrator } from "../../core/translation/translation-orchestrator.js";
import { TranslationProjectStore } from "../../core/translation/translation-project-store.js";
import { ProjectTranslationOrchestrator } from "../../core/translation/project-translation-orchestrator.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { CodeStore } from "../../core/code/code-store.js";
import { logger } from "../../core/utils/logger.js";

const UploadSchema = z.object({
  targetLanguage: z.string().min(1),
  name: z.string().optional(),
});

const PrepareSchema = z.object({
  fileIds: z.array(z.string()).optional(),
});

const FinalizeFileSchema = z.object({
  generatedCode: z.string().min(1),
});

const upload = multer({
  dest: path.join(tmpdir(), "mcp-graph-translation-uploads"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith(".zip")) cb(null, true);
    else cb(new Error("Only .zip files are supported"));
  },
});

export function createTranslationProjectRouter(storeRef: StoreRef, eventBus?: GraphEventBus): Router {
  const router = Router();

  let _cachedDb: unknown = null;
  let _translationStore: TranslationStore | null = null;
  let _registry: ConstructRegistry | null = null;
  let _orchestrator: TranslationOrchestrator | null = null;
  let _projectStore: TranslationProjectStore | null = null;
  let _projectOrchestrator: ProjectTranslationOrchestrator | null = null;

  function getProjectOrchestrator(): ProjectTranslationOrchestrator {
    const db = storeRef.current.getDb();
    if (db !== _cachedDb) {
      _cachedDb = db;
      _registry = new ConstructRegistry(db);
      loadAndSeedRegistry(_registry);
      _translationStore = new TranslationStore(db);
      const codeStore = new CodeStore(db);
      _orchestrator = new TranslationOrchestrator(_registry, _translationStore, codeStore);
      _projectStore = new TranslationProjectStore(db);
      _projectOrchestrator = new ProjectTranslationOrchestrator(
        _orchestrator,
        _projectStore,
        _translationStore,
      );
    }
    return _projectOrchestrator as ProjectTranslationOrchestrator;
  }

  function getProjectStore(): TranslationProjectStore {
    getProjectOrchestrator(); // ensure initialized
    return _projectStore as TranslationProjectStore;
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
    if (msg.includes("Invalid") || msg.includes("validation")) return 400;
    return 500;
  }

  /** POST /upload — Upload ZIP + create project + analyze all files */
  router.post("/upload", upload.single("file"), async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const parsed = UploadSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
        return;
      }

      const { targetLanguage, name } = parsed.data;
      const projectId = requireProjectId();
      const projectOrchestrator = getProjectOrchestrator();
      const projectStore = getProjectStore();

      logger.info("Creating translation project from ZIP", { projectId, targetLanguage, name });

      const project = projectOrchestrator.createFromZip(projectId, file.path, targetLanguage, name);
      projectOrchestrator.analyzeProject(project.id);

      const files = projectStore.getFiles(project.id);

      eventBus?.emit({
        type: "translation:job_created",
        timestamp: new Date().toISOString(),
        payload: { projectId: project.id, fileCount: files.length, targetLanguage },
      });

      res.status(201).json({ project, files });
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation project upload failed", { error: err });
      res.status(status).json({ error: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      if (file) {
        unlink(file.path).catch(() => {});
      }
    }
  });

  /** GET / — List projects */
  router.get("/", (_req, res) => {
    try {
      const projectId = requireProjectId();
      const projects = getProjectStore().listProjects(projectId);
      res.json({ projects });
    } catch (err) {
      logger.error("Translation project list failed", { error: err });
      res.status(errorStatus(err)).json({ error: err instanceof Error ? err.message : "List failed" });
    }
  });

  /** GET /:id — Get project with files */
  router.get("/:id", (req, res) => {
    try {
      const projectStore = getProjectStore();
      const project = projectStore.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const files = projectStore.getFiles(req.params.id);
      res.json({ project, files });
    } catch (err) {
      logger.error("Translation project get failed", { error: err });
      res.status(errorStatus(err)).json({ error: err instanceof Error ? err.message : "Get failed" });
    }
  });

  /** POST /:id/prepare — Prepare translation for files */
  router.post("/:id/prepare", async (req, res) => {
    try {
      const parsed = PrepareSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
        return;
      }

      const projectOrchestrator = getProjectOrchestrator();
      const projectStore = getProjectStore();
      const { id } = req.params;

      let fileIds = parsed.data.fileIds;
      if (!fileIds || fileIds.length === 0) {
        const files = projectStore.getFiles(id);
        fileIds = files
          .filter((f) => f.status === "analyzed")
          .map((f) => f.id);
      }

      logger.info("Preparing translation for files", { projectId: id, fileCount: fileIds.length });

      const results: Array<{ fileId: string; jobId: string; prompt: string }> = [];
      for (const fileId of fileIds) {
        const result = projectOrchestrator.prepareFile(id, fileId);
        results.push({ fileId, ...result });
      }

      res.json({ results });
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation project prepare failed", { error: err });
      res.status(status).json({ error: err instanceof Error ? err.message : "Prepare failed" });
    }
  });

  /** POST /:id/files/:fileId/finalize — Finalize one file */
  router.post("/:id/files/:fileId/finalize", async (req, res) => {
    try {
      const parsed = FinalizeFileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
        return;
      }

      const { id, fileId } = req.params;
      const projectOrchestrator = getProjectOrchestrator();

      logger.info("Finalizing translation file", { projectId: id, fileId });

      const result = projectOrchestrator.finalizeFile(id, fileId, parsed.data.generatedCode);

      eventBus?.emit({
        type: "translation:finalized",
        timestamp: new Date().toISOString(),
        payload: { projectId: id, fileId },
      });

      res.json(result);
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation file finalize failed", { error: err });
      res.status(status).json({ error: err instanceof Error ? err.message : "Finalize failed" });
    }
  });

  /** GET /:id/download — Download ZIP */
  router.get("/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const projectOrchestrator = getProjectOrchestrator();

      logger.info("Generating download ZIP", { projectId: id });

      const buffer = projectOrchestrator.generateDownloadZip(id);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="translation-project-${id}.zip"`);
      res.send(buffer);
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation project download failed", { error: err });
      res.status(status).json({ error: err instanceof Error ? err.message : "Download failed" });
    }
  });

  /** GET /:id/files/:fileId/download — Download single file */
  router.get("/:id/files/:fileId/download", (req, res) => {
    try {
      const { fileId } = req.params;
      getProjectOrchestrator(); // ensure stores initialized
      const projectStore = getProjectStore();

      const file = projectStore.getFile(fileId);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      if (!file.jobId) {
        res.status(400).json({ error: "File has no translation job" });
        return;
      }

      const job = (_translationStore as TranslationStore).getJob(file.jobId);
      if (!job || !job.targetCode) {
        res.status(404).json({ error: "Translation not found or not finalized" });
        return;
      }

      const fileName = path.basename(file.filePath);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(job.targetCode);
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation file download failed", { error: err });
      res.status(status).json({ error: err instanceof Error ? err.message : "File download failed" });
    }
  });

  /** GET /:id/summary — Get project summary */
  router.get("/:id/summary", async (req, res) => {
    try {
      const { id } = req.params;
      const projectOrchestrator = getProjectOrchestrator();

      const summary = projectOrchestrator.getProjectSummary(id);
      res.json(summary);
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation project summary failed", { error: err });
      res.status(status).json({ error: err instanceof Error ? err.message : "Summary failed" });
    }
  });

  /** GET /:id/graph — Get graph data for React Flow */
  router.get("/:id/graph", (req, res) => {
    try {
      const { id } = req.params;
      const projectStore = getProjectStore();
      const files = projectStore.getFiles(id);

      const nodes = files.map((f) => ({
        id: f.id,
        path: f.filePath,
        language: f.sourceLanguage,
        status: f.status,
        confidence: f.confidenceScore,
      }));

      res.json({ nodes, edges: [] });
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation project graph failed", { error: err });
      res.status(status).json({ error: err instanceof Error ? err.message : "Graph failed" });
    }
  });

  /** DELETE /:id — Delete project */
  router.delete("/:id", (req, res) => {
    try {
      const { id } = req.params;
      const projectStore = getProjectStore();

      logger.info("Deleting translation project", { projectId: id });

      const deleted = projectStore.deleteProject(id);
      if (!deleted) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      const status = errorStatus(err);
      logger.error("Translation project delete failed", { error: err });
      res.status(status).json({ error: err instanceof Error ? err.message : "Delete failed" });
    }
  });

  return router;
}
