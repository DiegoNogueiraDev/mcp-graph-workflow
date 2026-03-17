/**
 * PRD Indexer — indexes PRD text content into the knowledge store
 * so that original requirements can be queried in later lifecycle phases.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { logger } from "../utils/logger.js";
import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

export interface PrdIndexResult {
  documentsIndexed: number;
  sourceFile: string;
}

/**
 * Index PRD text content into the knowledge store.
 * Chunks the content and stores with source_type='prd'.
 */
export function indexPrdContent(
  knowledgeStore: KnowledgeStore,
  content: string,
  sourceFile: string,
  phase?: LifecyclePhase,
): PrdIndexResult {
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    logger.info("No content to index from PRD", { sourceFile });
    return { documentsIndexed: 0, sourceFile };
  }

  const sourceId = `prd:${sourceFile}`;

  // Remove previous version to re-index fresh content
  knowledgeStore.deleteBySource("prd", sourceId);

  const docs = knowledgeStore.insertChunks(
    chunks.map((chunk) => ({
      sourceType: "prd" as const,
      sourceId,
      title: chunks.length > 1
        ? `PRD: ${sourceFile} [${chunk.index + 1}/${chunks.length}]`
        : `PRD: ${sourceFile}`,
      content: chunk.content,
      chunkIndex: chunk.index,
      metadata: {
        sourceFile,
        phase: phase ?? "ANALYZE",
        indexedAt: new Date().toISOString(),
      },
    })),
  );

  logger.info("PRD content indexed", { sourceFile, chunks: docs.length });

  return { documentsIndexed: docs.length, sourceFile };
}
