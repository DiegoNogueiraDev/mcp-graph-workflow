/**
 * Chunked Analyzer — splits large files at class/function boundaries before analyzing.
 *
 * When source code exceeds a configurable threshold (default 50KB),
 * the code is split at language-aware boundaries (class/function definitions)
 * and each chunk is analyzed independently, then results are merged.
 */

import type { TranslationAnalysis } from "./translation-types.js";

// ── Types ──────────────────────────────────────────

interface AnalyzeHints {
  languageHint?: string;
  targetLanguage?: string;
}

type AnalyzeFn = (code: string, hints?: AnalyzeHints) => TranslationAnalysis & { cacheHit: boolean };

interface ChunkedAnalyzerOptions {
  /** Threshold in bytes above which chunking is applied. Default: 51200 (50KB) */
  chunkThresholdBytes?: number;
}

// ── Boundary patterns per language ────────────────

const BOUNDARY_PATTERNS: ReadonlyMap<string, RegExp> = new Map([
  ["python", /^(?:class |def )/m],
  ["typescript", /^(?:export |class |function )/m],
  ["javascript", /^(?:export |class |function )/m],
  ["java", /^(?:public class |class )/m],
  ["csharp", /^(?:public class |class )/m],
  ["go", /^func /m],
]);

const DEFAULT_CHUNK_LINES = 1000;
const DEFAULT_THRESHOLD_BYTES = 51_200; // 50KB

// ── Public API ────────────────────────────────────

/**
 * Split code at class/function boundaries for a given language.
 * Falls back to splitting every 1000 lines if no language-specific pattern exists.
 */
export function splitAtBoundaries(code: string, language: string): string[] {
  const lines = code.split("\n");
  const pattern = BOUNDARY_PATTERNS.get(language);

  if (!pattern) {
    return splitByLineCount(lines, DEFAULT_CHUNK_LINES);
  }

  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const line of lines) {
    // If this line is a boundary and we already have accumulated lines, flush
    if (pattern.test(line) && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
      currentChunk = [];
    }
    currentChunk.push(line);
  }

  // Flush remaining
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }

  return chunks.length > 0 ? chunks : [code];
}

/**
 * Analyze code with chunking support.
 * If code is below the threshold, delegates to single-pass analysis.
 * Otherwise splits into chunks, analyzes each, and merges results.
 */
export function analyzeChunked(
  code: string,
  analyzeFn: AnalyzeFn,
  hints?: AnalyzeHints,
  options?: ChunkedAnalyzerOptions,
): TranslationAnalysis & { cacheHit: boolean; chunked: boolean; chunkCount: number } {
  const threshold = options?.chunkThresholdBytes ?? DEFAULT_THRESHOLD_BYTES;
  const codeSizeBytes = Buffer.byteLength(code, "utf-8");

  // Small file — single-pass analysis
  if (codeSizeBytes <= threshold) {
    const result = analyzeFn(code, hints);
    return { ...result, chunked: false, chunkCount: 1 };
  }

  // Detect language for boundary splitting
  const language = hints?.languageHint ?? "unknown";
  const chunks = splitAtBoundaries(code, language);

  // Analyze each chunk
  const analyses = chunks.map((chunk) => analyzeFn(chunk, hints));

  // Merge results
  return mergeAnalyses(analyses, chunks.length);
}

// ── Internal helpers ──────────────────────────────

function splitByLineCount(lines: string[], count: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += count) {
    chunks.push(lines.slice(i, i + count).join("\n"));
  }
  return chunks.length > 0 ? chunks : [lines.join("\n")];
}

function mergeAnalyses(
  analyses: Array<TranslationAnalysis & { cacheHit: boolean }>,
  chunkCount: number,
): TranslationAnalysis & { cacheHit: boolean; chunked: boolean; chunkCount: number } {
  if (analyses.length === 0) {
    return {
      detectedLanguage: "unknown",
      detectedConfidence: 0,
      constructs: [],
      complexityScore: 0,
      estimatedTranslatability: 0,
      ambiguousConstructs: [],
      totalConstructs: 0,
      cacheHit: false,
      chunked: true,
      chunkCount,
    };
  }

  // Use first chunk's language detection (most reliable — typically has imports/headers)
  const detectedLanguage = analyses[0].detectedLanguage;
  const detectedConfidence = analyses[0].detectedConfidence;

  // Sum construct counts across chunks
  const constructMap = new Map<string, { count: number; confidence: number }>();
  let totalConstructs = 0;

  for (const analysis of analyses) {
    totalConstructs += analysis.totalConstructs;
    for (const c of analysis.constructs) {
      const existing = constructMap.get(c.canonicalName);
      if (existing) {
        existing.count += c.count;
        // Keep max confidence for this construct
        existing.confidence = Math.max(existing.confidence, c.confidence);
      } else {
        constructMap.set(c.canonicalName, { count: c.count, confidence: c.confidence });
      }
    }
  }

  const constructs = Array.from(constructMap.entries()).map(([id, info]) => ({
    canonicalName: id,
    count: info.count,
    confidence: info.confidence,
  }));

  // Max complexity across chunks
  const complexityScore = Math.max(...analyses.map((a) => a.complexityScore));

  // Weighted average translatability (weighted by totalConstructs per chunk)
  const totalWeight = analyses.reduce((sum, a) => sum + a.totalConstructs, 0);
  const estimatedTranslatability = totalWeight > 0
    ? analyses.reduce((sum, a) => sum + a.estimatedTranslatability * a.totalConstructs, 0) / totalWeight
    : 0;

  // Union of ambiguous constructs
  const ambiguousSet = new Set<string>();
  for (const analysis of analyses) {
    if (analysis.ambiguousConstructs) {
      for (const id of analysis.ambiguousConstructs) {
        ambiguousSet.add(id);
      }
    }
  }

  // cacheHit is true only if ALL chunks were cache hits
  const cacheHit = analyses.every((a) => a.cacheHit);

  return {
    detectedLanguage,
    detectedConfidence,
    constructs,
    complexityScore,
    estimatedTranslatability,
    ambiguousConstructs: Array.from(ambiguousSet),
    totalConstructs,
    cacheHit,
    chunked: true,
    chunkCount,
  };
}
