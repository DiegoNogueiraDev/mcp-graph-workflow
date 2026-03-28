/**
 * Text chunking utility — splits large documents into overlapping chunks
 * for granular embedding and retrieval.
 *
 * Strategy: sentence-aware splitting with configurable chunk size and overlap.
 * Default ~500 tokens/chunk (~2000 chars) with 10% overlap.
 */

import { estimateTokens } from "../context/token-estimator.js";

export interface ChunkOptions {
  /** Target tokens per chunk (default: 500) */
  maxTokens?: number;
  /** Overlap tokens between consecutive chunks (default: 50) */
  overlapTokens?: number;
}

export interface TextChunk {
  /** Zero-based chunk index */
  index: number;
  /** Chunk text content */
  content: string;
  /** Estimated token count */
  tokens: number;
}

const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

/**
 * Split text into sentence-aware chunks with overlap.
 * If text fits in a single chunk, returns one chunk.
 */
export function chunkText(text: string, options?: ChunkOptions): TextChunk[] {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;

  const trimmed = text.trim();
  if (!trimmed) return [];

  const totalTokens = estimateTokens(trimmed);
  if (totalTokens <= maxTokens) {
    return [{ index: 0, content: trimmed, tokens: totalTokens }];
  }

  // Split into sentences (preserve the delimiter)
  const sentences = splitSentences(trimmed);

  const chunks: TextChunk[] = [];
  let currentSentences: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence);

    // If a single sentence exceeds maxTokens, split it by chars
    if (sentTokens > maxTokens && currentSentences.length === 0) {
      const hardChunks = hardSplit(sentence, maxTokens, overlapTokens);
      for (const hc of hardChunks) {
        chunks.push({ index: chunks.length, content: hc, tokens: estimateTokens(hc) });
      }
      continue;
    }

    if (currentTokens + sentTokens > maxTokens && currentSentences.length > 0) {
      // Emit current chunk
      const chunkContent = currentSentences.join("").trim();
      chunks.push({
        index: chunks.length,
        content: chunkContent,
        tokens: estimateTokens(chunkContent),
      });

      // Build overlap from tail of current sentences
      const overlapResult = buildOverlap(currentSentences, overlapTokens);
      currentSentences = overlapResult;
      currentTokens = estimateTokens(overlapResult.join(""));
    }

    currentSentences.push(sentence);
    currentTokens += sentTokens;
  }

  // Emit last chunk
  if (currentSentences.length > 0) {
    const chunkContent = currentSentences.join("").trim();
    if (chunkContent) {
      chunks.push({
        index: chunks.length,
        content: chunkContent,
        tokens: estimateTokens(chunkContent),
      });
    }
  }

  return chunks;
}

/**
 * Split text into sentences. Keeps delimiters attached to the sentence.
 */
function splitSentences(text: string): string[] {
  // Split on sentence boundaries but keep the delimiter
  const parts = text.split(/(?<=[.!?\n])\s+/);
  return parts.filter((p) => p.length > 0);
}

/**
 * Hard-split a long string into chunks of roughly maxTokens.
 */
function hardSplit(text: string, maxTokens: number, overlapTokens: number): string[] {
  const maxChars = maxTokens * 4; // ~4 chars per token
  const overlapChars = overlapTokens * 4;
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlapChars;
    if (start >= text.length) break;
    // Prevent infinite loop if overlap >= chunk size
    if (end === text.length) break;
  }

  return chunks;
}

/**
 * Content-type-aware chunking strategy.
 * Selects chunk size and splitting strategy based on source type.
 */
export function smartChunk(text: string, contentType: string, options?: ChunkOptions): TextChunk[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  switch (contentType) {
    case "docs":
      return chunkByStrategy(trimmed, {
        maxTokens: options?.maxTokens ?? 800,
        overlapTokens: options?.overlapTokens ?? 80,
        splitFn: splitPreservingCodeBlocks,
      });
    case "prd":
    case "design":
      return chunkByStrategy(trimmed, {
        maxTokens: options?.maxTokens ?? 600,
        overlapTokens: options?.overlapTokens ?? 60,
        splitFn: splitByMarkdownHeaders,
      });
    case "memory":
    case "ai_decision":
    case "synthesis":
      return chunkText(trimmed, {
        maxTokens: options?.maxTokens ?? 300,
        overlapTokens: options?.overlapTokens ?? 30,
      });
    case "code_context":
      return chunkByStrategy(trimmed, {
        maxTokens: options?.maxTokens ?? 500,
        overlapTokens: options?.overlapTokens ?? 50,
        splitFn: splitByCodeBoundaries,
      });
    case "web_capture":
      return chunkText(trimmed, {
        maxTokens: options?.maxTokens ?? 500,
        overlapTokens: options?.overlapTokens ?? 50,
      });
    default:
      return chunkText(trimmed, options);
  }
}

interface StrategyOptions {
  maxTokens: number;
  overlapTokens: number;
  splitFn: (text: string) => string[];
}

/**
 * Chunk text using a custom split function, then merge segments up to maxTokens.
 */
function chunkByStrategy(text: string, opts: StrategyOptions): TextChunk[] {
  const totalTokens = estimateTokens(text);
  if (totalTokens <= opts.maxTokens) {
    return [{ index: 0, content: text, tokens: totalTokens }];
  }

  const segments = opts.splitFn(text);
  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const segment of segments) {
    const segTokens = estimateTokens(segment);

    // If single segment exceeds max, chunk it with default splitter
    if (segTokens > opts.maxTokens && current.length === 0) {
      const subChunks = chunkText(segment, {
        maxTokens: opts.maxTokens,
        overlapTokens: opts.overlapTokens,
      });
      for (const sc of subChunks) {
        chunks.push({ index: chunks.length, content: sc.content, tokens: sc.tokens });
      }
      continue;
    }

    if (currentTokens + segTokens > opts.maxTokens && current.length > 0) {
      const chunkContent = current.join("\n\n").trim();
      if (chunkContent) {
        chunks.push({
          index: chunks.length,
          content: chunkContent,
          tokens: estimateTokens(chunkContent),
        });
      }
      current = [];
      currentTokens = 0;
    }

    current.push(segment);
    currentTokens += segTokens;
  }

  if (current.length > 0) {
    const chunkContent = current.join("\n\n").trim();
    if (chunkContent) {
      chunks.push({
        index: chunks.length,
        content: chunkContent,
        tokens: estimateTokens(chunkContent),
      });
    }
  }

  return chunks;
}

/**
 * Split text preserving code blocks as atomic units.
 */
function splitPreservingCodeBlocks(text: string): string[] {
  const parts: string[] = [];
  const codeBlockRegex = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before code block
    const before = text.slice(lastIndex, match.index).trim();
    if (before) {
      parts.push(...before.split(/\n\n+/).filter((s) => s.trim()));
    }
    // Code block as atomic unit
    parts.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    parts.push(...remaining.split(/\n\n+/).filter((s) => s.trim()));
  }

  return parts;
}

/**
 * Split by markdown headers (h1, h2, h3).
 */
function splitByMarkdownHeaders(text: string): string[] {
  const sections = text.split(/(?=^#{1,3}\s)/m);
  return sections.filter((s) => s.trim());
}

/**
 * Split by code boundaries (function/class/export declarations).
 */
function splitByCodeBoundaries(text: string): string[] {
  // eslint-disable-next-line security/detect-unsafe-regex -- lookahead with optional keyword prefix; no nested quantifiers on overlapping chars
  const sections = text.split(/(?=\n(?:export\s+)?(?:function|class|interface|type|const|enum)\s)/);
  return sections.filter((s) => s.trim());
}

/**
 * Build overlap sentences from the tail of the current sentence list.
 */
function buildOverlap(sentences: string[], overlapTokens: number): string[] {
  const result: string[] = [];
  let tokens = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentTokens = estimateTokens(sentences[i]);
    if (tokens + sentTokens > overlapTokens && result.length > 0) break;
    result.unshift(sentences[i]);
    tokens += sentTokens;
  }

  return result;
}
