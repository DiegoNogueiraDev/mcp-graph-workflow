/**
 * Post-Retrieval Pipeline — processes search results after initial retrieval.
 *
 * Pipeline stages:
 * 1. Deduplication — remove results with identical content
 * 2. Reranking — boost results with higher query keyword overlap
 * 3. Chunk stitching — merge adjacent chunks from the same source
 * 4. Limit — enforce maxResults
 */

import type { RankedResult } from "./multi-strategy-retrieval.js";
import { tokenize } from "../search/tokenizer.js";
import { logger } from "../utils/logger.js";

export interface PostRetrievalOptions {
  query: string;
  results: RankedResult[];
  maxResults: number;
  chunkMeta?: Map<string, number>;
}

export interface PostRetrievalResult {
  results: RankedResult[];
  deduplicated: number;
  stitchedChunks: number;
}

/**
 * Remove results with identical content, keeping the highest-scored one.
 */
export function deduplicateResults(results: RankedResult[]): RankedResult[] {
  const seen = new Map<string, RankedResult>();

  for (const result of results) {
    const key = result.content.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || result.score > existing.score) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

/**
 * Rerank results by keyword overlap with the query.
 * Combines original score with keyword overlap boost.
 */
export function rerankByKeywordOverlap(
  results: RankedResult[],
  query: string,
): RankedResult[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return results;

  const scored = results.map((r) => {
    const contentTokens = tokenize(r.content);
    const overlap = contentTokens.filter((t) => queryTokens.has(t)).length;
    const overlapRatio = contentTokens.length > 0 ? overlap / queryTokens.size : 0;
    // Combine: 70% original score + 30% keyword overlap
    const combinedScore = r.score * 0.7 + overlapRatio * 0.3;
    return { ...r, score: Math.round(combinedScore * 10000) / 10000 };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Merge adjacent chunks from the same source document.
 * Chunks are considered adjacent if their chunk indices differ by 1.
 */
export function stitchAdjacentChunks(
  results: RankedResult[],
  chunkMeta: Map<string, number>,
): RankedResult[] {
  if (results.length <= 1 || chunkMeta.size === 0) return results;

  // Group by sourceId
  const groups = new Map<string, RankedResult[]>();
  const ungrouped: RankedResult[] = [];

  for (const r of results) {
    const chunkIdx = chunkMeta.get(r.id);
    if (chunkIdx === undefined) {
      ungrouped.push(r);
      continue;
    }
    const group = groups.get(r.sourceId) ?? [];
    group.push(r);
    groups.set(r.sourceId, group);
  }

  const stitched: RankedResult[] = [];

  for (const [_sourceId, group] of groups) {
    // Sort by chunk index
    group.sort((a, b) => (chunkMeta.get(a.id) ?? 0) - (chunkMeta.get(b.id) ?? 0));

    let current = group[0];
    let currentIdx = chunkMeta.get(current.id) ?? 0;

    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      const nextIdx = chunkMeta.get(next.id) ?? 0;

      if (nextIdx === currentIdx + 1) {
        // Stitch: merge content, keep higher score
        current = {
          ...current,
          content: current.content + "\n\n" + next.content,
          score: Math.max(current.score, next.score),
          strategies: [...new Set([...current.strategies, ...next.strategies])],
        };
        currentIdx = nextIdx;
      } else {
        stitched.push(current);
        current = next;
        currentIdx = nextIdx;
      }
    }
    stitched.push(current);
  }

  const final = [...stitched, ...ungrouped].sort((a, b) => b.score - a.score);
  return final;
}

/**
 * Full post-retrieval pipeline.
 */
export function postRetrievalPipeline(options: PostRetrievalOptions): PostRetrievalResult {
  const { query, results, maxResults, chunkMeta } = options;

  // Stage 1: Deduplication
  const deduped = deduplicateResults(results);
  const deduplicated = results.length - deduped.length;

  // Stage 2: Reranking
  const reranked = rerankByKeywordOverlap(deduped, query);

  // Stage 3: Chunk stitching (if metadata available)
  const stitched = chunkMeta
    ? stitchAdjacentChunks(reranked, chunkMeta)
    : reranked;
  const stitchedChunks = reranked.length - stitched.length;

  // Stage 4: Limit
  const limited = stitched.slice(0, maxResults);

  logger.debug("Post-retrieval pipeline complete", {
    input: results.length,
    deduplicated,
    stitchedChunks,
    output: limited.length,
  });

  return { results: limited, deduplicated, stitchedChunks };
}
