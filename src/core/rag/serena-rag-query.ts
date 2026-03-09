/**
 * Serena RAG Query — semantic search over Serena memory documents.
 *
 * Supports three modes:
 * - fts: keyword search via FTS5 (fast, exact match)
 * - semantic: TF-IDF cosine similarity (broader, cross-vocabulary)
 * - hybrid: combines FTS and semantic results with deduplication
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { EmbeddingStore } from "./embedding-store.js";
import { indexAllEmbeddings, semanticSearch } from "./rag-pipeline.js";
import { logger } from "../utils/logger.js";

export interface SerenaRagOptions {
  /** Search mode: fts (keyword), semantic (embeddings), hybrid (both) */
  mode?: "fts" | "semantic" | "hybrid";
  /** Maximum results to return */
  limit?: number;
}

export interface SerenaRagResultItem {
  id: string;
  title: string;
  content: string;
  sourceId: string;
  score: number;
  method: "fts" | "semantic";
}

export interface SerenaRagResult {
  query: string;
  mode: "fts" | "semantic" | "hybrid";
  results: SerenaRagResultItem[];
  totalSerenaDocuments: number;
}

/**
 * Query Serena memories using FTS, semantic search, or hybrid.
 */
export async function querySerenaMemories(
  store: SqliteStore,
  query: string,
  options?: SerenaRagOptions,
): Promise<SerenaRagResult> {
  const mode = options?.mode ?? "fts";
  const limit = options?.limit ?? 10;

  const knowledgeStore = new KnowledgeStore(store.getDb());
  const totalSerenaDocuments = knowledgeStore.count("serena");

  if (totalSerenaDocuments === 0) {
    logger.info("No Serena memories in knowledge store", { query });
    return { query, mode, results: [], totalSerenaDocuments: 0 };
  }

  const results: SerenaRagResultItem[] = [];
  const seenIds = new Set<string>();

  // FTS search
  if (mode === "fts" || mode === "hybrid") {
    const ftsResults = knowledgeStore.search(query, limit);
    for (const doc of ftsResults) {
      if (doc.sourceType !== "serena") continue;
      if (seenIds.has(doc.id)) continue;
      seenIds.add(doc.id);
      results.push({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        sourceId: doc.sourceId,
        score: 1.0, // FTS results are relevance-ranked but no numeric score exposed
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
      // Filter to only serena-sourced knowledge
      if (result.source !== "knowledge") continue;

      const doc = knowledgeStore.getById(result.sourceId);
      if (!doc || doc.sourceType !== "serena") continue;
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

  logger.info("Serena RAG query completed", {
    query,
    mode,
    resultsCount: limited.length,
    totalSerenaDocuments,
  });

  return { query, mode, results: limited, totalSerenaDocuments };
}
