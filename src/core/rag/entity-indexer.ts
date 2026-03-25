/**
 * Entity Indexer — orchestrates entity extraction from knowledge documents
 * and populates the EntityStore (Knowledge Graph).
 *
 * Processes knowledge documents to extract entities and relations,
 * storing them in the KG tables for graph-based retrieval.
 */

import type Database from "better-sqlite3";
import { EntityStore } from "./entity-store.js";
import { extractEntitiesFromText, extractRelationsFromText } from "./entity-extractor.js";
import { logger } from "../utils/logger.js";

// ── Result types ─────────────────────────────────────────

export interface IndexDocumentResult {
  docId: string;
  entitiesCreated: number;
  relationsCreated: number;
}

export interface ReindexResult {
  documentsProcessed: number;
  totalEntities: number;
  totalRelations: number;
  totalMentions: number;
}

// ── Core functions ───────────────────────────────────────

/**
 * Index a single knowledge document — extract entities and relations,
 * store in the KG.
 */
export function indexDocument(db: Database.Database, docId: string): IndexDocumentResult {
  const store = new EntityStore(db);

  // Fetch the document content
  const doc = db
    .prepare("SELECT id, title, content FROM knowledge_documents WHERE id = ?")
    .get(docId) as { id: string; title: string; content: string } | undefined;

  if (!doc) {
    logger.debug("entity-indexer:doc-not-found", { docId });
    return { docId, entitiesCreated: 0, relationsCreated: 0 };
  }

  // Combine title + content for richer extraction
  const fullText = `${doc.title}\n${doc.content}`;

  // Extract entities
  const extractedEntities = extractEntitiesFromText(fullText);
  let entitiesCreated = 0;

  // Map entity names to their store IDs for relation linking
  const entityNameToId = new Map<string, string>();

  for (const extracted of extractedEntities) {
    const entity = store.upsertEntity(extracted.name, extracted.type, docId);
    entityNameToId.set(extracted.name, entity.id);
    entitiesCreated++;
  }

  // Extract relations
  const extractedRelations = extractRelationsFromText(fullText, extractedEntities);
  let relationsCreated = 0;

  for (const rel of extractedRelations) {
    const fromId = entityNameToId.get(rel.fromName);
    const toId = entityNameToId.get(rel.toName);

    if (fromId && toId) {
      const result = store.addRelation(
        fromId,
        toId,
        rel.relationType,
        rel.weight,
        docId,
      );
      if (result) relationsCreated++;
    }
  }

  logger.debug("entity-indexer:indexed", {
    docId,
    entities: entitiesCreated,
    relations: relationsCreated,
  });

  return { docId, entitiesCreated, relationsCreated };
}

/**
 * Reindex all knowledge documents — clear KG and rebuild from scratch.
 */
export function reindexAll(db: Database.Database): ReindexResult {
  const store = new EntityStore(db);

  // Clear existing KG data
  store.clear();

  // Fetch all knowledge documents
  const docs = db
    .prepare("SELECT id FROM knowledge_documents")
    .all() as Array<{ id: string }>;

  let documentsProcessed = 0;

  for (const doc of docs) {
    indexDocument(db, doc.id);
    documentsProcessed++;
  }

  const stats = store.stats();

  logger.info("entity-indexer:reindex-complete", {
    documentsProcessed,
    ...stats,
  });

  return {
    documentsProcessed,
    totalEntities: stats.entities,
    totalRelations: stats.relations,
    totalMentions: stats.mentions,
  };
}

/**
 * Index a batch of documents by their IDs.
 */
export function indexBatch(
  db: Database.Database,
  docIds: string[],
): IndexDocumentResult[] {
  return docIds.map((docId) => indexDocument(db, docId));
}
