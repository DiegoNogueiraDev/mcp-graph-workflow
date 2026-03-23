/**
 * Siebel Indexer — indexes parsed SIF content into the knowledge store
 * for RAG retrieval during Siebel development workflows.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";
import type { SiebelSifParseResult, SiebelObject } from "../../schemas/siebel.schema.js";

export interface SiebelIndexResult {
  documentsIndexed: number;
  sourceFile: string;
}

/**
 * Index parsed SIF content into the knowledge store.
 * Each Siebel object becomes a knowledge document for RAG retrieval.
 */
export function indexSifContent(
  knowledgeStore: KnowledgeStore,
  parseResult: SiebelSifParseResult,
): SiebelIndexResult {
  const { metadata, objects, dependencies } = parseResult;

  if (objects.length === 0) {
    logger.info("No Siebel objects to index", { sourceFile: metadata.fileName });
    return { documentsIndexed: 0, sourceFile: metadata.fileName };
  }

  const sourceId = `siebel_sif:${metadata.fileName}`;

  // Remove previous version to re-index fresh content
  knowledgeStore.deleteBySource("siebel_sif", sourceId);

  // Build content for each object
  const chunks = objects.map((obj, index) => ({
    sourceType: "siebel_sif" as const,
    sourceId,
    title: `Siebel ${obj.type}: ${obj.name}`,
    content: buildObjectContent(obj, dependencies.filter(
      (d) => d.from.name === obj.name || d.to.name === obj.name,
    )),
    chunkIndex: index,
    metadata: {
      siebelType: obj.type,
      siebelProject: obj.project,
      fileName: metadata.fileName,
      indexedAt: new Date().toISOString(),
    },
  }));

  const docs = knowledgeStore.insertChunks(chunks);

  logger.info("Siebel SIF content indexed", {
    sourceFile: metadata.fileName,
    documents: String(docs.length),
  });

  return { documentsIndexed: docs.length, sourceFile: metadata.fileName };
}

/**
 * Build searchable text content from a Siebel object.
 */
function buildObjectContent(
  obj: SiebelObject,
  relatedDeps: { from: { name: string; type: string }; to: { name: string; type: string }; relationType: string }[],
): string {
  const parts: string[] = [];

  parts.push(`# ${obj.type.replace(/_/g, " ").toUpperCase()}: ${obj.name}`);

  if (obj.project) {
    parts.push(`Project: ${obj.project}`);
  }

  if (obj.properties.length > 0) {
    parts.push("## Properties");
    for (const prop of obj.properties) {
      parts.push(`- ${prop.name}: ${prop.value}`);
    }
  }

  if (obj.children.length > 0) {
    parts.push("## Children");
    for (const child of obj.children) {
      const childProps = child.properties.map((p) => `${p.name}=${p.value}`).join(", ");
      parts.push(`- ${child.type}: ${child.name}${childProps ? ` (${childProps})` : ""}`);
    }
  }

  if (relatedDeps.length > 0) {
    parts.push("## Dependencies");
    for (const dep of relatedDeps) {
      if (dep.from.name === obj.name) {
        parts.push(`- ${dep.relationType} → ${dep.to.type}: ${dep.to.name}`);
      } else {
        parts.push(`- ${dep.from.type}: ${dep.from.name} ${dep.relationType} → this`);
      }
    }
  }

  return parts.join("\n");
}
