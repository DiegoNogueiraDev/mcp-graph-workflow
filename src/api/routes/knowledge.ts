/**
 * Knowledge API routes — upload, list, search knowledge documents.
 * Knowledge docs are reference material (not PRD tasks).
 */

import { Router } from "express";
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { KnowledgeSourceTypeSchema } from "../../schemas/knowledge.schema.js";
import { chunkText } from "../../core/rag/chunk-text.js";
import { logger } from "../../core/utils/logger.js";

const UploadSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  sourceType: KnowledgeSourceTypeSchema.optional(),
  sourceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const SearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

export function createKnowledgeRouter(storeRef: StoreRef): Router {
  const router = Router();

  /** Lazy knowledge store — re-creates when the underlying DB changes. */
  let _cachedDb: unknown = null;
  let _knowledgeStore: KnowledgeStore | null = null;
  function getKnowledgeStore(): KnowledgeStore {
    const db = storeRef.current.getDb();
    if (db !== _cachedDb) {
      _cachedDb = db;
      _knowledgeStore = new KnowledgeStore(db);
    }
    return _knowledgeStore!;
  }

  // ── POST / — upload a knowledge document ─────
  router.post("/", (req, res, next) => {
    try {
      const parsed = UploadSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
        return;
      }

      const { title, content, sourceType, sourceId, metadata } = parsed.data;
      const chunks = chunkText(content);
      const knowledgeStore = getKnowledgeStore();

      const docs = knowledgeStore.insertChunks(
        chunks.map((chunk) => ({
          sourceType: sourceType ?? "upload",
          sourceId: sourceId ?? `upload-${Date.now()}`,
          title: chunks.length > 1 ? `${title} [${chunk.index + 1}/${chunks.length}]` : title,
          content: chunk.content,
          chunkIndex: chunk.index,
          metadata,
        })),
      );

      logger.info("Knowledge uploaded", { title, chunks: docs.length });

      res.status(201).json({
        ok: true,
        documents: docs,
        chunksCreated: docs.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── GET / — list knowledge documents ──────────
  router.get("/", (req, res, next) => {
    try {
      const sourceType = req.query.sourceType as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const knowledgeStore = getKnowledgeStore();

      const validSourceType = sourceType
        ? KnowledgeSourceTypeSchema.safeParse(sourceType)
        : undefined;

      const docs = knowledgeStore.list({
        sourceType: validSourceType?.success ? validSourceType.data : undefined,
        limit,
        offset,
      });

      res.json({
        documents: docs,
        total: knowledgeStore.count(
          validSourceType?.success ? validSourceType.data : undefined,
        ),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /search — FTS search knowledge ──────
  router.post("/search", (req, res, next) => {
    try {
      const parsed = SearchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Missing required field: query" });
        return;
      }

      const { query, limit } = parsed.data;
      const knowledgeStore = getKnowledgeStore();
      const results = knowledgeStore.search(query, limit ?? 20);

      res.json({
        query,
        results,
        total: results.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /:id — get a knowledge document ──────
  router.get("/:id", (req, res, next) => {
    try {
      const knowledgeStore = getKnowledgeStore();
      const doc = knowledgeStore.getById(req.params.id);
      if (!doc) {
        res.status(404).json({ error: "Knowledge document not found" });
        return;
      }
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  // ── DELETE /:id — delete a knowledge document ─
  router.delete("/:id", (req, res, next) => {
    try {
      const knowledgeStore = getKnowledgeStore();
      const deleted = knowledgeStore.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Knowledge document not found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /stats — knowledge store stats ────────
  router.get("/stats/summary", (_req, res, next) => {
    try {
      const knowledgeStore = getKnowledgeStore();
      const total = knowledgeStore.count();
      const bySource: Record<string, number> = {};
      const sourceTypes = ["upload", "serena", "code_context", "docs", "web_capture"] as const;
      for (const st of sourceTypes) {
        const c = knowledgeStore.count(st);
        if (c > 0) bySource[st] = c;
      }

      res.json({ total, bySource });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
