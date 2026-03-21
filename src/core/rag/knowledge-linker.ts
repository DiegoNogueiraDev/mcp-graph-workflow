/**
 * Knowledge Linker — creates cross-source relationships between knowledge documents
 * based on shared nodeId, tags, and source_id patterns.
 *
 * v1: Lightweight linking via metadata matching (no embedding similarity).
 */

import type Database from "better-sqlite3";
import type { KnowledgeDocument } from "../../schemas/knowledge.schema.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

interface DocWithMeta {
  id: string;
  sourceType: string;
  sourceId: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Link knowledge documents that share context (nodeId, tags, source patterns).
 */
export function linkBySharedContext(db: Database.Database): { relationsCreated: number } {
  const docs = db
    .prepare("SELECT id, source_type, source_id, metadata FROM knowledge_documents")
    .all() as Array<{ id: string; source_type: string; source_id: string; metadata: string | null }>;

  const parsed: DocWithMeta[] = docs.map((d) => ({
    id: d.id,
    sourceType: d.source_type,
    sourceId: d.source_id,
    metadata: d.metadata ? JSON.parse(d.metadata) : null,
  }));

  let relationsCreated = 0;
  const insertRelation = db.prepare(
    `INSERT OR IGNORE INTO knowledge_relations (id, from_doc_id, to_doc_id, relation, score, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const timestamp = now();

  db.transaction(() => {
    // Strategy 1: Link by shared nodeId (score 1.0)
    const byNodeId = new Map<string, DocWithMeta[]>();
    for (const doc of parsed) {
      const nodeId = doc.metadata?.nodeId as string | undefined;
      if (nodeId) {
        const group = byNodeId.get(nodeId) ?? [];
        group.push(doc);
        byNodeId.set(nodeId, group);
      }
    }

    for (const [, group] of byNodeId) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const result = insertRelation.run(
            generateId("krel"),
            group[i].id,
            group[j].id,
            "related_to",
            1.0,
            timestamp,
          );
          if (result.changes > 0) relationsCreated++;
        }
      }
    }

    // Strategy 2: Link by shared tags (score 0.7)
    const byTag = new Map<string, DocWithMeta[]>();
    for (const doc of parsed) {
      const tags = doc.metadata?.tags as string[] | undefined;
      if (tags && Array.isArray(tags)) {
        for (const tag of tags) {
          const group = byTag.get(tag) ?? [];
          group.push(doc);
          byTag.set(tag, group);
        }
      }
    }

    for (const [, group] of byTag) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          // Skip if already linked by nodeId
          if (group[i].id === group[j].id) continue;
          const result = insertRelation.run(
            generateId("krel"),
            group[i].id,
            group[j].id,
            "related_to",
            0.7,
            timestamp,
          );
          if (result.changes > 0) relationsCreated++;
        }
      }
    }
  })();

  logger.info("Knowledge linking completed", { relationsCreated });
  return { relationsCreated };
}

/**
 * Find documents related to a given doc via knowledge_relations.
 * Returns docs from different source types for cross-referencing.
 */
export function findCrossSourceContext(
  db: Database.Database,
  docId: string,
  limit: number = 10,
): KnowledgeDocument[] {
  const rows = db
    .prepare(
      `SELECT kd.* FROM knowledge_relations kr
       JOIN knowledge_documents kd ON kd.id = kr.to_doc_id
       WHERE kr.from_doc_id = ?
       UNION
       SELECT kd.* FROM knowledge_relations kr
       JOIN knowledge_documents kd ON kd.id = kr.from_doc_id
       WHERE kr.to_doc_id = ?
       LIMIT ?`,
    )
    .all(docId, docId, limit) as Array<{
      id: string;
      source_type: string;
      source_id: string;
      title: string;
      content: string;
      content_hash: string;
      chunk_index: number;
      metadata: string | null;
      created_at: string;
      updated_at: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    sourceType: row.source_type as KnowledgeDocument["sourceType"],
    sourceId: row.source_id,
    title: row.title,
    content: row.content,
    contentHash: row.content_hash,
    chunkIndex: row.chunk_index,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
