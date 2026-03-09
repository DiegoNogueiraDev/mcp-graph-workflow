/**
 * Serena Indexer — reads .serena/memories/*.md and stores them
 * as knowledge documents for unified search.
 */

import { readAllSerenaMemories } from "../integrations/serena-reader.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { logger } from "../utils/logger.js";

export interface SerenaIndexResult {
  memoriesFound: number;
  documentsIndexed: number;
  skippedDuplicates: number;
}

/**
 * Index all Serena memory files into the knowledge store.
 * Chunks large memories and deduplicates by content hash.
 */
export async function indexSerenaMemories(
  knowledgeStore: KnowledgeStore,
  basePath: string,
): Promise<SerenaIndexResult> {
  const memories = await readAllSerenaMemories(basePath);

  if (memories.length === 0) {
    logger.info("No Serena memories found to index", { basePath });
    return { memoriesFound: 0, documentsIndexed: 0, skippedDuplicates: 0 };
  }

  let documentsIndexed = 0;
  let skippedDuplicates = 0;
  const countBefore = knowledgeStore.count("serena");

  for (const memory of memories) {
    const chunks = chunkText(memory.content);

    for (const chunk of chunks) {
      const doc = knowledgeStore.insert({
        sourceType: "serena",
        sourceId: `serena:${memory.name}`,
        title: chunks.length > 1
          ? `${memory.name} [${chunk.index + 1}/${chunks.length}]`
          : memory.name,
        content: chunk.content,
        chunkIndex: chunk.index,
        metadata: { sizeBytes: memory.sizeBytes, memoryName: memory.name },
      });

      // Check if this was a dedup hit (id already existed)
      if (knowledgeStore.count("serena") === countBefore + documentsIndexed) {
        skippedDuplicates++;
      } else {
        documentsIndexed++;
      }
    }
  }

  logger.info("Serena memories indexed", {
    memoriesFound: memories.length,
    documentsIndexed,
    skippedDuplicates,
  });

  return { memoriesFound: memories.length, documentsIndexed, skippedDuplicates };
}
