/**
 * Enrichment Pipeline — enriches text chunks with keywords, entities, and summaries
 * before indexation into the knowledge store.
 *
 * Transforms raw TextChunks into EnrichedChunks with:
 * - TF-IDF-based keyword extraction (top-N terms)
 * - Regex-based entity detection (PascalCase, camelCase, file paths)
 * - Auto-generated summary (first sentence or markdown heading)
 * - Parent-child chunk linking for later chunk stitching
 */

import type { TextChunk } from "./chunk-text.js";
import { tokenize } from "../search/tokenizer.js";
import { logger } from "../utils/logger.js";

export interface EnrichedChunk extends TextChunk {
  /** Top-N keywords extracted via TF-IDF term frequency */
  keywords: string[];
  /** Detected entities: class names, function names, file paths */
  entities: string[];
  /** Auto-generated summary (first sentence or heading) */
  summary: string;
  /** Source type discriminator */
  sourceType: string;
  /** Reference to parent chunk index for chunk stitching */
  parentChunkIndex?: number;
}

const MAX_SUMMARY_LENGTH = 200;
const DEFAULT_TOP_N = 5;

/**
 * Extract top-N keywords from text using term frequency scoring.
 * Uses the project tokenizer (handles PT + EN, strips stopwords).
 */
export function extractKeywords(text: string, topN: number = DEFAULT_TOP_N): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  // Count term frequencies
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  // Sort by frequency descending, then alphabetically for stability
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return sorted.slice(0, topN).map(([term]) => term);
}

// ── Entity detection patterns ──────────────────────────────

/** PascalCase: at least two words joined (e.g., GraphNode, SqliteStore) */
const PASCAL_CASE_RE = /\b([A-Z][a-z]+(?:[A-Z][a-z0-9]*)+)\b/g;

/** camelCase: starts lowercase, has at least one uppercase (e.g., findNextTask) */
const CAMEL_CASE_RE = /\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g;

/** File paths: src/... or similar path patterns ending in common extensions */
const FILE_PATH_RE = /\b((?:src|lib|dist|test|tests)\/[\w\-./]+\.(?:ts|js|tsx|jsx|json|md|sql))\b/g;

/**
 * Extract named entities from text using regex patterns.
 * Detects PascalCase types, camelCase functions, and file paths.
 */
export function extractEntities(text: string): string[] {
  const entities = new Set<string>();

  let match: RegExpExecArray | null;

  // PascalCase (reset lastIndex before each scan)
  PASCAL_CASE_RE.lastIndex = 0;
  while ((match = PASCAL_CASE_RE.exec(text)) !== null) {
    entities.add(match[1]);
  }

  // camelCase
  CAMEL_CASE_RE.lastIndex = 0;
  while ((match = CAMEL_CASE_RE.exec(text)) !== null) {
    entities.add(match[1]);
  }

  // File paths
  FILE_PATH_RE.lastIndex = 0;
  while ((match = FILE_PATH_RE.exec(text)) !== null) {
    entities.add(match[1]);
  }

  return Array.from(entities);
}

/**
 * Generate a short summary from chunk content.
 * Prefers markdown heading if present, otherwise first sentence.
 */
export function generateSummary(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  // Check for markdown heading
  const headingMatch = trimmed.match(/^#{1,6}\s+(.+)/m);
  if (headingMatch) {
    const heading = headingMatch[1].trim();
    return heading.length > MAX_SUMMARY_LENGTH
      ? heading.slice(0, MAX_SUMMARY_LENGTH)
      : heading;
  }

  // First sentence (ends with . ! or ?)
  const sentenceMatch = trimmed.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch) {
    const sentence = sentenceMatch[0].trim();
    return sentence.length > MAX_SUMMARY_LENGTH
      ? sentence.slice(0, MAX_SUMMARY_LENGTH)
      : sentence;
  }

  // Fallback: truncate to MAX_SUMMARY_LENGTH
  return trimmed.length > MAX_SUMMARY_LENGTH
    ? trimmed.slice(0, MAX_SUMMARY_LENGTH)
    : trimmed;
}

/**
 * Enrich a single text chunk with keywords, entities, summary, and source metadata.
 */
export function enrichChunk(
  chunk: TextChunk,
  sourceType: string,
  parentChunkIndex?: number,
): EnrichedChunk {
  const keywords = extractKeywords(chunk.content);
  const entities = extractEntities(chunk.content);
  const summary = generateSummary(chunk.content);

  logger.debug("Chunk enriched", {
    index: chunk.index,
    sourceType,
    keywordCount: keywords.length,
    entityCount: entities.length,
  });

  return {
    ...chunk,
    keywords,
    entities,
    summary,
    sourceType,
    parentChunkIndex,
  };
}

/**
 * Enrich multiple chunks from the same document.
 * Applies parent-child linking for multi-chunk documents.
 */
export function enrichChunks(
  chunks: TextChunk[],
  sourceType: string,
): EnrichedChunk[] {
  if (chunks.length <= 1) {
    return chunks.map((c) => enrichChunk(c, sourceType));
  }

  // For multi-chunk documents, first chunk (index 0) is the "parent" reference
  return chunks.map((c, i) =>
    enrichChunk(c, sourceType, i === 0 ? undefined : 0),
  );
}
