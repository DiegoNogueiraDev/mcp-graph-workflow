/**
 * RAG Semantic Pipeline — indexes nodes as embeddings and provides semantic search.
 *
 * Strategy: Uses lightweight TF-IDF vectorization for embeddings (no external deps).
 * This provides semantic-like search without requiring transformers.js (~400MB).
 * Can be upgraded to real transformer embeddings later.
 *
 * All processing is local — no external API calls.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { EmbeddingStore, type SimilarityResult } from "./embedding-store.js";
import { logger } from "../utils/logger.js";

// ── TF-IDF Vectorizer ───────────────────────────

/**
 * Simple tokenizer: lowercase, split on non-alphanumeric, remove stopwords.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "can", "could", "must", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "and", "but",
  "or", "nor", "not", "so", "yet", "both", "either", "neither", "each",
  "every", "all", "any", "few", "more", "most", "other", "some", "such",
  "no", "only", "own", "same", "than", "too", "very", "that", "this",
  "these", "those", "it", "its", "he", "she", "they", "them", "their",
  "we", "our", "you", "your", "i", "me", "my", "what", "which", "who",
  "whom", "when", "where", "why", "how",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Build a vocabulary from all documents and compute IDF values.
 */
function buildVocabulary(documents: string[][]): { vocab: Map<string, number>; idf: Map<string, number> } {
  const docFreq = new Map<string, number>();
  const allTerms = new Set<string>();

  for (const tokens of documents) {
    const unique = new Set(tokens);
    for (const term of unique) {
      allTerms.add(term);
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  // Assign index to each term
  const vocab = new Map<string, number>();
  let idx = 0;
  for (const term of allTerms) {
    vocab.set(term, idx++);
  }

  // Compute IDF: log(N / df)
  const N = documents.length;
  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1); // smoothed IDF
  }

  return { vocab, idf };
}

/**
 * Compute TF-IDF vector for a document using the given vocabulary.
 */
function computeTfIdfVector(tokens: string[], vocab: Map<string, number>, idf: Map<string, number>): number[] {
  const vector = new Array(vocab.size).fill(0);

  // Term frequency
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }

  // TF-IDF
  for (const [term, count] of tf) {
    const idx = vocab.get(term);
    if (idx !== undefined) {
      const termIdf = idf.get(term) ?? 1;
      vector[idx] = (count / tokens.length) * termIdf;
    }
  }

  // L2 normalize
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

/**
 * TF-IDF Vectorizer — encapsulates vocabulary and IDF state per instance.
 * Avoids module-level mutable state.
 */
export class TfIdfVectorizer {
  private vocab: Map<string, number> | null = null;
  private idf: Map<string, number> | null = null;

  get vocabSize(): number {
    return this.vocab?.size ?? 0;
  }

  /**
   * Build vocabulary and IDF from tokenized documents.
   */
  fit(documents: string[][]): void {
    const result = buildVocabulary(documents);
    this.vocab = result.vocab;
    this.idf = result.idf;
  }

  /**
   * Generate an embedding for text using TF-IDF vectorization.
   * Falls back to hash-based embedding if vocabulary not built.
   */
  embed(text: string): number[] {
    if (!this.vocab || !this.idf) {
      return hashEmbed(text, 128);
    }
    return computeTfIdfVector(tokenize(text), this.vocab, this.idf);
  }
}

/**
 * Simple hash-based embedding fallback.
 * Maps text to a fixed-size vector using character hashing.
 */
function hashEmbed(text: string, dim: number): number[] {
  const vector = new Array(dim).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % dim;
    vector[idx] += 1;
  }

  // L2 normalize
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

// ── Pipeline functions ──────────────────────────

// Module-level vectorizer shared between index and search.
// Encapsulated in class — no raw mutable `let` variables.
let activeVectorizer: TfIdfVectorizer | null = null;

/**
 * Index all nodes from the store as embeddings.
 * Builds a TF-IDF vocabulary from all node texts, then stores vectors.
 */
export async function indexNodeEmbeddings(
  store: SqliteStore,
  embeddingStore: EmbeddingStore,
): Promise<number> {
  const nodes = store.getAllNodes();
  if (nodes.length === 0) {
    logger.info("No nodes to index for embeddings");
    return 0;
  }

  // Build document texts
  const documents: Array<{ id: string; text: string; tokens: string[] }> = nodes.map((node) => {
    const text = [
      node.title,
      node.description ?? "",
      (node.tags ?? []).join(" "),
      node.type,
    ].filter(Boolean).join(" | ");

    return {
      id: `node:${node.id}`,
      text,
      tokens: tokenize(text),
    };
  });

  // Build vocabulary and fit vectorizer
  const t0 = performance.now();
  const vectorizer = new TfIdfVectorizer();
  vectorizer.fit(documents.map((d) => d.tokens));
  activeVectorizer = vectorizer;

  // Generate and store embeddings
  let indexed = 0;
  for (const doc of documents) {
    const vector = vectorizer.embed(doc.text);

    embeddingStore.upsert({
      id: doc.id,
      source: "node",
      sourceId: doc.id.replace("node:", ""),
      text: doc.text,
      embedding: vector,
    });
    indexed++;
  }

  const durationMs = Math.round(performance.now() - t0);
  logger.debug("rag:fit+embed:nodes", { vocabSize: vectorizer.vocabSize, indexed, durationMs });
  logger.info(`Indexed ${indexed} node embeddings (vocab size: ${vectorizer.vocabSize})`);
  return indexed;
}

/**
 * Index all sources (nodes + knowledge documents) as embeddings with a unified vocabulary.
 * This produces cross-source similarity by fitting TF-IDF on the combined corpus.
 */
export async function indexAllEmbeddings(
  store: SqliteStore,
  embeddingStore: EmbeddingStore,
): Promise<{ nodes: number; knowledge: number }> {
  const nodes = store.getAllNodes();
  const knowledgeStore = new KnowledgeStore(store.getDb());
  const knowledgeDocs = knowledgeStore.list({ limit: 10000 });

  if (nodes.length === 0 && knowledgeDocs.length === 0) {
    logger.info("No documents to index for embeddings");
    return { nodes: 0, knowledge: 0 };
  }

  // Build combined document corpus
  const allDocuments: Array<{ id: string; text: string; tokens: string[] }> = [];

  for (const node of nodes) {
    const text = [
      node.title,
      node.description ?? "",
      (node.tags ?? []).join(" "),
      node.type,
    ].filter(Boolean).join(" | ");

    allDocuments.push({
      id: `node:${node.id}`,
      text,
      tokens: tokenize(text),
    });
  }

  for (const doc of knowledgeDocs) {
    const text = [doc.title, doc.content].join(" | ");

    allDocuments.push({
      id: `knowledge:${doc.id}`,
      text,
      tokens: tokenize(text),
    });
  }

  // Build unified vocabulary
  const t0 = performance.now();
  const vectorizer = new TfIdfVectorizer();
  vectorizer.fit(allDocuments.map((d) => d.tokens));
  activeVectorizer = vectorizer;

  // Generate and store embeddings
  let indexedNodes = 0;
  let indexedKnowledge = 0;

  for (const doc of allDocuments) {
    const vector = vectorizer.embed(doc.text);
    const isNode = doc.id.startsWith("node:");

    embeddingStore.upsert({
      id: doc.id,
      source: isNode ? "node" : "knowledge",
      sourceId: doc.id.replace(/^(node|knowledge):/, ""),
      text: doc.text,
      embedding: vector,
    });

    if (isNode) indexedNodes++;
    else indexedKnowledge++;
  }

  const durationMs = Math.round(performance.now() - t0);
  logger.debug("rag:fit+embed:all", { vocabSize: vectorizer.vocabSize, indexedNodes, indexedKnowledge, durationMs });
  logger.info(
    `Indexed all embeddings (vocab size: ${vectorizer.vocabSize})`,
    { nodes: indexedNodes, knowledge: indexedKnowledge },
  );

  return { nodes: indexedNodes, knowledge: indexedKnowledge };
}

/**
 * Semantic search using embeddings.
 * Embeds the query and finds similar documents.
 */
export async function semanticSearch(
  embeddingStore: EmbeddingStore,
  query: string,
  limit: number = 10,
): Promise<SimilarityResult[]> {
  const t0 = performance.now();
  const vectorizer = activeVectorizer ?? new TfIdfVectorizer();
  const queryVector = vectorizer.embed(query);
  const results = embeddingStore.findSimilar(queryVector, limit);
  const durationMs = Math.round(performance.now() - t0);

  logger.debug("rag:search", { query: query.slice(0, 80), resultCount: results.length, durationMs });
  return results;
}
