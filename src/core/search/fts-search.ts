import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";
import { rerankWithTfIdf } from "./tfidf.js";

export interface SearchResult {
  node: GraphNode;
  score: number;
}

export interface SearchOptions {
  limit?: number;
  rerank?: boolean;
}

/**
 * Sanitize user query for FTS5 — escape special characters and
 * convert spaces to implicit AND (FTS5 default).
 */
function sanitizeFtsQuery(raw: string): string {
  // Remove FTS5 special operators that could cause syntax errors
  const cleaned = raw
    .replace(/[*"(){}[\]:^~!@#$%&|\\]/g, " ")
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) return '""';

  // Wrap each term in double quotes for exact matching, join with space (implicit AND)
  const terms = cleaned.split(" ").filter(Boolean);
  return terms.map((t) => `"${t}"`).join(" ");
}

/**
 * Search nodes using FTS5 full-text search with BM25 ranking.
 * Optionally applies TF-IDF reranking for better relevance.
 */
export function searchNodes(
  store: SqliteStore,
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  const { limit = 20, rerank = false } = options;
  const sanitized = sanitizeFtsQuery(query);
  logger.debug("FTS search start", { query, sanitized, rerank });

  // Stage 1: FTS5 candidates (fetch extra for reranking)
  const startMs = performance.now();
  const candidateLimit = rerank ? Math.min(limit * 3, 100) : limit;
  const ftsResults = store.searchNodes(sanitized, candidateLimit);
  logger.debug("FTS search complete", {
    resultCount: ftsResults.length,
    durationMs: Math.round(performance.now() - startMs),
  });

  const resultMap = new Map<string, GraphNode>();
  for (const r of ftsResults) {
    const { score: _score, ...node } = r;
    resultMap.set(node.id, node as GraphNode);
  }

  if (!rerank || ftsResults.length === 0) {
    return ftsResults.map((r) => {
      const { score, ...node } = r;
      return { node: node as GraphNode, score };
    });
  }

  // Stage 2: TF-IDF reranking
  const candidates = ftsResults.map((r) => ({
    id: r.id,
    text: [r.title, r.description ?? "", (r as unknown as { tags?: string[] }).tags?.join(" ") ?? ""].join(" "),
  }));

  const reranked = rerankWithTfIdf(candidates, query, limit);

  return reranked
    .map((r) => {
      const node = resultMap.get(r.id);
      if (!node) return null;
      return { node, score: r.score };
    })
    .filter((r): r is SearchResult => r !== null);
}
