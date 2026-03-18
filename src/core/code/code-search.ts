/**
 * Code symbol search using FTS5 + optional TF-IDF reranking.
 * Reuses patterns from core/search/fts-search.ts and core/search/tfidf.ts.
 */

import type { CodeStore } from "./code-store.js";
import type { CodeSearchResult } from "./code-types.js";
import { rerankWithTfIdf } from "../search/tfidf.js";
import { logger } from "../utils/logger.js";

export interface CodeSearchOptions {
  limit?: number;
  rerank?: boolean;
  groupByModule?: boolean;
}

/**
 * Sanitize user query for FTS5 — escape special characters.
 */
function sanitizeFtsQuery(raw: string): string {
  const cleaned = raw
    .replace(/[*"(){}[\]:^~!@#$%&|\\]/g, " ")
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) return '""';

  const terms = cleaned.split(" ").filter(Boolean);
  // Use prefix matching (*) for code symbol search — "validate" should match "validateNode"
  return terms.map((t) => `"${t}"*`).join(" ");
}

/**
 * Search code symbols using FTS5 with optional TF-IDF reranking.
 */
export function searchCodeSymbols(
  store: CodeStore,
  query: string,
  projectId: string,
  options: CodeSearchOptions = {},
): CodeSearchResult[] {
  const { limit = 20, rerank = false, groupByModule = false } = options;
  const sanitized = sanitizeFtsQuery(query);

  logger.debug("code-search:start", { query, sanitized, rerank, groupByModule });

  const startMs = performance.now();
  const candidateLimit = rerank ? Math.min(limit * 3, 100) : limit;
  const ftsResults = store.searchSymbols(sanitized, projectId, candidateLimit);

  logger.debug("code-search:fts", {
    resultCount: ftsResults.length,
    durationMs: Math.round(performance.now() - startMs),
  });

  if (ftsResults.length === 0) return [];

  let results: CodeSearchResult[];

  if (rerank) {
    const candidates = ftsResults.map((r) => ({
      id: r.symbol.id,
      text: [r.symbol.name, r.symbol.file, r.symbol.signature ?? ""].join(" "),
    }));

    const reranked = rerankWithTfIdf(candidates, query, limit);
    const symbolMap = new Map(ftsResults.map((r) => [r.symbol.id, r]));

    results = [];
    for (const r of reranked) {
      const match = symbolMap.get(r.id);
      if (!match) continue;
      results.push({
        symbol: match.symbol,
        score: r.score,
        modulePath: match.symbol.modulePath,
      });
    }
  } else {
    results = ftsResults.slice(0, limit).map((r) => ({
      symbol: r.symbol,
      score: r.score,
      modulePath: r.symbol.modulePath,
    }));
  }

  if (groupByModule) {
    // Sort by module path for grouping
    results.sort((a, b) => {
      const ma = a.modulePath ?? "";
      const mb = b.modulePath ?? "";
      if (ma !== mb) return ma.localeCompare(mb);
      return b.score - a.score;
    });
  }

  return results;
}
