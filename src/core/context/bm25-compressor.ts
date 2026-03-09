/**
 * BM25 Compressor — filters text chunks by relevance before consuming token budget.
 * Uses BM25 scoring to rank chunks and discard low-relevance ones.
 *
 * BM25 parameters: k1=1.5, b=0.75 (standard defaults)
 */

import { estimateTokens } from "./token-estimator.js";

export interface RankedChunk {
  content: string;
  score: number;
  tokens: number;
}

const K1 = 1.5;
const B = 0.75;

/**
 * Tokenize text for BM25 (lowercase, split, remove short words).
 */
function bm25Tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Score and rank text chunks by BM25 relevance to a query.
 * Returns chunks sorted by score (descending).
 */
export function rankChunksByBm25(
  chunks: string[],
  query: string,
): RankedChunk[] {
  if (chunks.length === 0 || !query.trim()) return [];

  const queryTerms = bm25Tokenize(query);
  if (queryTerms.length === 0) {
    return chunks.map((c) => ({ content: c, score: 0, tokens: estimateTokens(c) }));
  }

  // Compute document frequencies
  const tokenizedChunks = chunks.map(bm25Tokenize);
  const docFreq = new Map<string, number>();
  const totalDocs = chunks.length;

  for (const tokens of tokenizedChunks) {
    const unique = new Set(tokens);
    for (const term of unique) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  // Average document length
  const avgDl = tokenizedChunks.reduce((sum, t) => sum + t.length, 0) / totalDocs;

  // Score each chunk
  const ranked: RankedChunk[] = chunks.map((chunk, i) => {
    const tokens = tokenizedChunks[i];
    const dl = tokens.length;
    let score = 0;

    // Term frequency map
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    for (const term of queryTerms) {
      const termTf = tf.get(term) ?? 0;
      if (termTf === 0) continue;

      const df = docFreq.get(term) ?? 0;
      const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
      const tfNorm = (termTf * (K1 + 1)) / (termTf + K1 * (1 - B + B * (dl / avgDl)));

      score += idf * tfNorm;
    }

    return {
      content: chunk,
      score,
      tokens: estimateTokens(chunk),
    };
  });

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/**
 * Select top chunks within a token budget, ranked by BM25 relevance.
 */
export function compressWithBm25(
  chunks: string[],
  query: string,
  tokenBudget: number,
): RankedChunk[] {
  const ranked = rankChunksByBm25(chunks, query);
  const selected: RankedChunk[] = [];
  let tokensUsed = 0;

  for (const chunk of ranked) {
    if (tokensUsed + chunk.tokens > tokenBudget && selected.length > 0) break;
    selected.push(chunk);
    tokensUsed += chunk.tokens;
  }

  return selected;
}
