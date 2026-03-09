/**
 * Capture Indexer — indexes web capture results into the knowledge store.
 * Called after captureWebPage() to persist extracted content for search.
 */

import type { CaptureResult } from "../capture/web-capture.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { logger } from "../utils/logger.js";

export interface CaptureIndexResult {
  documentsIndexed: number;
  url: string;
}

/**
 * Index a web capture result into the knowledge store.
 * Chunks the extracted text and stores with source_type='web_capture'.
 */
export function indexCapture(
  knowledgeStore: KnowledgeStore,
  capture: CaptureResult,
): CaptureIndexResult {
  const chunks = chunkText(capture.text);

  if (chunks.length === 0) {
    logger.info("No content to index from capture", { url: capture.url });
    return { documentsIndexed: 0, url: capture.url };
  }

  const sourceId = `capture:${capture.url}`;

  // Remove previous capture of this URL to avoid stale data
  knowledgeStore.deleteBySource("web_capture", sourceId);

  const docs = knowledgeStore.insertChunks(
    chunks.map((chunk) => ({
      sourceType: "web_capture" as const,
      sourceId,
      title: chunks.length > 1
        ? `Web: ${capture.url} [${chunk.index + 1}/${chunks.length}]`
        : `Web: ${capture.url}`,
      content: chunk.content,
      chunkIndex: chunk.index,
      metadata: {
        url: capture.url,
        capturedAt: capture.capturedAt,
        wordCount: capture.wordCount,
      },
    })),
  );

  logger.info("Web capture indexed", { url: capture.url, chunks: docs.length });

  return { documentsIndexed: docs.length, url: capture.url };
}
