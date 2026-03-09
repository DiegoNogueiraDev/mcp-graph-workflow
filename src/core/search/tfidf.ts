/**
 * Lightweight TF-IDF implementation for two-stage search reranking.
 * No external dependencies — pure TypeScript.
 */

import { tokenize } from "./tokenizer.js";

interface DocumentEntry {
  id: string;
  tokens: string[];
  termFreq: Map<string, number>;
}

export class TfIdfIndex {
  private docs: DocumentEntry[] = [];
  private docFreq: Map<string, number> = new Map();

  /**
   * Add a document to the index.
   */
  addDocument(id: string, text: string): void {
    const tokens = tokenize(text);
    const termFreq = new Map<string, number>();

    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }

    // Update document frequency
    for (const term of termFreq.keys()) {
      this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
    }

    this.docs.push({ id, tokens, termFreq });
  }

  /**
   * Compute TF-IDF score for a query against all documents.
   * Returns sorted results (highest score first).
   */
  search(query: string, limit: number = 20): Array<{ id: string; score: number }> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const n = this.docs.length;
    if (n === 0) return [];

    const results: Array<{ id: string; score: number }> = [];

    for (const doc of this.docs) {
      let score = 0;
      const docLen = doc.tokens.length || 1;

      for (const qt of queryTokens) {
        const tf = (doc.termFreq.get(qt) ?? 0) / docLen;
        const df = this.docFreq.get(qt) ?? 0;
        if (df === 0) continue;

        // IDF with smoothing: log(1 + N/df)
        const idf = Math.log(1 + n / df);
        score += tf * idf;
      }

      if (score > 0) {
        results.push({ id: doc.id, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}

/**
 * Build a TF-IDF index from search result nodes and rerank them.
 * Two-stage: FTS5 candidates → TF-IDF reranking.
 */
export function rerankWithTfIdf(
  candidates: Array<{ id: string; text: string }>,
  query: string,
  limit: number = 20,
): Array<{ id: string; score: number }> {
  const index = new TfIdfIndex();
  for (const c of candidates) {
    index.addDocument(c.id, c.text);
  }
  return index.search(query, limit);
}
