/**
 * Memory RAG Query — semantic search over memory documents.
 *
 * Supports three modes:
 * - fts: keyword search via FTS5 (fast, exact match)
 * - semantic: TF-IDF cosine similarity (broader, cross-vocabulary)
 * - hybrid: combines FTS and semantic results with deduplication
 *
 * Accepts both "memory" and "serena" sourceType for backward compatibility.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { EmbeddingStore } from "./embedding-store.js";
import { indexAllEmbeddings, semanticSearch } from "./rag-pipeline.js";
import { multiStrategySearch } from "./multi-strategy-retrieval.js";
import { logger } from "../utils/logger.js";

export interface MemoryRagOptions {
  /** Search mode: fts (keyword), semantic (embeddings), hybrid (both), multi (multi-strategy) */
  mode?: "fts" | "semantic" | "hybrid" | "multi";
  /** Maximum results to return */
  limit?: number;
}

export interface MemoryRagResultItem {
  id: string;
  title: string;
  content: string;
  sourceId: string;
  score: number;
  method: "fts" | "semantic";
}

export interface MemoryRagResult {
  query: string;
  mode: "fts" | "semantic" | "hybrid" | "multi";
  results: MemoryRagResultItem[];
  totalMemoryDocuments: number;
}

/** Source types to include in memory queries (backward compat with "serena") */
const MEMORY_SOURCE_TYPES = new Set(["memory", "serena"]);

/**
 * Query memories using FTS, semantic search, or hybrid.
 */
export async function queryMemories(
  store: SqliteStore,
  query: string,
  options?: MemoryRagOptions,
): Promise<MemoryRagResult> {
  const mode = options?.mode ?? "fts";
  const limit = options?.limit ?? 10;

  const knowledgeStore = new KnowledgeStore(store.getDb());
  const totalMemoryDocuments = knowledgeStore.count("memory") + knowledgeStore.count("serena");

  if (totalMemoryDocuments === 0) {
    logger.info("No memories in knowledge store", { query });
    return { query, mode, results: [], totalMemoryDocuments: 0 };
  }

  const results: MemoryRagResultItem[] = [];
  const seenIds = new Set<string>();

  // Multi-strategy search (combines FTS, graph, quality, recency)
  if (mode === "multi") {
    const multiResults = multiStrategySearch(store.getDb(), query, { limit });
    for (const r of multiResults) {
      if (!MEMORY_SOURCE_TYPES.has(r.sourceType)) continue;
      results.push({
        id: r.id,
        title: r.title,
        content: r.content,
        sourceId: r.sourceId,
        score: r.score,
        method: "fts",
      });
    }

    return { query, mode, results: results.slice(0, limit), totalMemoryDocuments };
  }

  // FTS search
  if (mode === "fts" || mode === "hybrid") {
    const ftsResults = knowledgeStore.search(query, limit);
    for (const doc of ftsResults) {
      if (!MEMORY_SOURCE_TYPES.has(doc.sourceType)) continue;
      if (seenIds.has(doc.id)) continue;
      seenIds.add(doc.id);
      results.push({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        sourceId: doc.sourceId,
        score: 1.0,
        method: "fts",
      });
    }
  }

  // Semantic search
  if (mode === "semantic" || mode === "hybrid") {
    const embeddingStore = new EmbeddingStore(store);

    // Ensure embeddings are indexed
    await indexAllEmbeddings(store, embeddingStore);

    const semanticResults = await semanticSearch(embeddingStore, query, limit);
    for (const result of semanticResults) {
      if (result.source !== "knowledge") continue;

      const doc = knowledgeStore.getById(result.sourceId);
      if (!doc || !MEMORY_SOURCE_TYPES.has(doc.sourceType)) continue;
      if (seenIds.has(doc.id)) continue;
      seenIds.add(doc.id);

      results.push({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        sourceId: doc.sourceId,
        score: result.similarity,
        method: "semantic",
      });
    }
  }

  // Sort by score descending and limit
  results.sort((a, b) => b.score - a.score);
  const limited = results.slice(0, limit);

  logger.info("Memory RAG query completed", {
    query,
    mode,
    resultsCount: limited.length,
    totalMemoryDocuments,
  });

  return { query, mode, results: limited, totalMemoryDocuments };
}
