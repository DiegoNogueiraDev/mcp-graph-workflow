/**
 * Docs Indexer — mirrors docs_cache entries into the knowledge store.
 * Keeps backward compatibility with DocsCacheStore while enabling
 * unified search across all knowledge sources.
 */

import { DocsCacheStore } from "../docs/docs-cache-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { logger } from "../utils/logger.js";

export interface DocsIndexResult {
  docsFound: number;
  documentsIndexed: number;
  skippedDuplicates: number;
}

/**
 * Index all cached docs into the knowledge store.
 * Each cached doc is chunked and stored with source_type='docs'.
 */
export function indexCachedDocs(
  knowledgeStore: KnowledgeStore,
  docsCacheStore: DocsCacheStore,
): DocsIndexResult {
  const allDocs = docsCacheStore.listCached();

  if (allDocs.length === 0) {
    logger.info("No cached docs to index");
    return { docsFound: 0, documentsIndexed: 0, skippedDuplicates: 0 };
  }

  let documentsIndexed = 0;
  let skippedDuplicates = 0;

  for (const doc of allDocs) {
    const sourceId = `docs:${doc.libId}`;
    const chunks = chunkText(doc.content);

    // Remove previous version to re-index fresh content
    knowledgeStore.deleteBySource("docs", sourceId);

    for (const chunk of chunks) {
      const countBefore = knowledgeStore.count("docs");

      knowledgeStore.insert({
        sourceType: "docs",
        sourceId,
        title: chunks.length > 1
          ? `${doc.libName} [${chunk.index + 1}/${chunks.length}]`
          : doc.libName,
        content: chunk.content,
        chunkIndex: chunk.index,
        metadata: {
          libId: doc.libId,
          libName: doc.libName,
          version: doc.version,
          fetchedAt: doc.fetchedAt,
        },
      });

      if (knowledgeStore.count("docs") > countBefore) {
        documentsIndexed++;
      } else {
        skippedDuplicates++;
      }
    }
  }

  logger.info("Cached docs indexed", {
    docsFound: allDocs.length,
    documentsIndexed,
    skippedDuplicates,
  });

  return { docsFound: allDocs.length, documentsIndexed, skippedDuplicates };
}
