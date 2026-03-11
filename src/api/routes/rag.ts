/**
 * RAG API routes — semantic search endpoint.
 * Uses local embeddings for token-efficient retrieval.
 */

import { Router } from "express";
import { z } from "zod/v4";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { EmbeddingStore } from "../../core/rag/embedding-store.js";
import { indexAllEmbeddings, semanticSearch } from "../../core/rag/rag-pipeline.js";
import { logger } from "../../core/utils/logger.js";

const RagQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

export function createRagRouter(store: SqliteStore): Router {
  const router = Router();
  const embeddingStore = new EmbeddingStore(store);
  let indexed = false;

  // ── POST /query — semantic search ─────────────
  router.post("/query", async (req, res, next) => {
    try {
      const parsed = RagQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Missing required field: query" });
        return;
      }

      const { query, limit } = parsed.data;

      // Lazy index on first query — indexes nodes + knowledge docs
      if (!indexed) {
        const result = await indexAllEmbeddings(store, embeddingStore);
        indexed = (result.nodes + result.knowledge) > 0;
        logger.info("RAG index built on first query", { nodes: result.nodes, knowledge: result.knowledge });
      }

      const results = await semanticSearch(embeddingStore, query, limit ?? 10);

      res.json({
        query,
        results: results.map((r) => ({
          id: r.sourceId,
          text: r.text,
          similarity: Math.round(r.similarity * 1000) / 1000,
          source: r.source,
        })),
        totalIndexed: embeddingStore.count(),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /reindex — rebuild embeddings ────────
  router.post("/reindex", async (_req, res, next) => {
    try {
      embeddingStore.clear();
      const result = await indexAllEmbeddings(store, embeddingStore);
      indexed = (result.nodes + result.knowledge) > 0;

      res.json({ ok: true, indexed: result.nodes + result.knowledge, nodes: result.nodes, knowledge: result.knowledge });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /stats — embedding stats ──────────────
  router.get("/stats", (_req, res) => {
    res.json({
      totalEmbeddings: embeddingStore.count(),
      indexed,
    });
  });

  return router;
}
