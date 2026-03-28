/**
 * Translation Indexer — indexes translation evidence packs into the knowledge store
 * for RAG retrieval during future translation workflows.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

export interface TranslationEvidenceInput {
  jobId: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceCode: string;
  targetCode: string;
  scope: string;
  confidenceScore: number;
  translatedConstructs: Array<{ source: string; target: string; method: string }>;
  risks: Array<{ construct: string; severity: string; message: string }>;
  humanReviewPoints: string[];
}

export interface TranslationIndexResult {
  documentsIndexed: number;
  jobId: string;
}

/**
 * Index a translation evidence pack into the knowledge store.
 * Creates searchable documents with source/target code, construct mappings, and risks.
 */
export function indexTranslationEvidence(
  knowledgeStore: KnowledgeStore,
  evidence: TranslationEvidenceInput,
): TranslationIndexResult {
  const sourceId = `translation_evidence:${evidence.jobId}`;

  // Clean previous version (dedup on re-index)
  knowledgeStore.deleteBySource("translation_evidence", sourceId);

  // Build construct mapping report
  const mappingLines = evidence.translatedConstructs
    .map((c) => `${c.source} → ${c.target} (${c.method})`)
    .join("\n");

  // Build risks report
  const riskLines = evidence.risks
    .map((r) => `[${r.severity}] ${r.construct}: ${r.message}`)
    .join("\n");

  // Main document: source + target code + mapping
  const mainContent = [
    `Translation: ${evidence.sourceLanguage} → ${evidence.targetLanguage} (${evidence.scope})`,
    `Confidence: ${Math.round(evidence.confidenceScore * 100)}%`,
    "",
    "=== Source Code ===",
    evidence.sourceCode,
    "",
    "=== Target Code ===",
    evidence.targetCode,
    "",
    "=== Construct Mappings ===",
    mappingLines || "(none)",
    "",
    "=== Risks ===",
    riskLines || "(none)",
    "",
    "=== Human Review Points ===",
    evidence.humanReviewPoints.join("\n") || "(none)",
  ].join("\n");

  const metadata = {
    jobId: evidence.jobId,
    sourceLanguage: evidence.sourceLanguage,
    targetLanguage: evidence.targetLanguage,
    scope: evidence.scope,
    confidenceScore: evidence.confidenceScore,
    constructCount: evidence.translatedConstructs.length,
    riskCount: evidence.risks.length,
    indexedAt: new Date().toISOString(),
  };

  const docs = knowledgeStore.insertChunks([
    {
      sourceType: "translation_evidence",
      sourceId,
      title: `Translation: ${evidence.sourceLanguage} → ${evidence.targetLanguage} (${evidence.scope}, ${Math.round(evidence.confidenceScore * 100)}%)`,
      content: mainContent,
      chunkIndex: 0,
      metadata,
    },
  ]);

  logger.info("Translation evidence indexed", {
    jobId: evidence.jobId,
    sourceLanguage: evidence.sourceLanguage,
    targetLanguage: evidence.targetLanguage,
    documentsIndexed: String(docs.length),
  });

  return { documentsIndexed: docs.length, jobId: evidence.jobId };
}
