/**
 * Entity Store — SQLite CRUD and graph traversal for the Knowledge Graph.
 *
 * Stores entities, relations between entities, and mentions linking
 * entities to knowledge documents. Provides FTS5 search and BFS
 * traversal for subgraph extraction.
 */

import type Database from "better-sqlite3";
import type {
  Entity,
  EntityType,
  EntityRelationType,
  EntityRelation,
  EntityMention,
} from "../../schemas/entity.schema.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

// ── Row types (SQLite ↔ JS) ─────────────────────────────

interface EntityRow {
  id: string;
  name: string;
  type: string;
  normalized_name: string;
  aliases: string;
  description: string | null;
  metadata: string;
  mention_count: number;
  created_at: string;
  updated_at: string;
}

interface RelationRow {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  weight: number;
  source_doc_id: string | null;
  created_at: string;
}

interface MentionRow {
  id: string;
  entity_id: string;
  doc_id: string;
  context: string | null;
  position: number;
  created_at: string;
}

// ── Mappers ──────────────────────────────────────────────

function rowToEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    name: row.name,
    type: row.type as EntityType,
    normalizedName: row.normalized_name,
    aliases: JSON.parse(row.aliases) as string[],
    description: row.description,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    mentionCount: row.mention_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRelation(row: RelationRow): EntityRelation {
  return {
    id: row.id,
    fromEntityId: row.from_entity_id,
    toEntityId: row.to_entity_id,
    relationType: row.relation_type as EntityRelationType,
    weight: row.weight,
    sourceDocId: row.source_doc_id,
    createdAt: row.created_at,
  };
}

function rowToMention(row: MentionRow): EntityMention {
  return {
    id: row.id,
    entityId: row.entity_id,
    docId: row.doc_id,
    context: row.context,
    position: row.position,
    createdAt: row.created_at,
  };
}

// ── Normalize ────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

// ── Subgraph result ──────────────────────────────────────

export interface EntitySubgraph {
  entities: Entity[];
  relations: EntityRelation[];
  docIds: string[];
}

// ── Entity Store ─────────────────────────────────────────

export class EntityStore {
  constructor(private readonly db: Database.Database) {}

  /**
   * Check if the kg_entities table exists (graceful degradation).
   */
  hasKgTables(): boolean {
    const row = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kg_entities'")
      .get() as { name: string } | undefined;
    return row !== undefined;
  }

  /**
   * Upsert entity — insert if new, increment mention_count if existing.
   * Deduplication key: normalized_name + type.
   */
  upsertEntity(name: string, type: EntityType, docId?: string): Entity {
    const normalized = normalizeName(name);
    const timestamp = now();

    const existing = this.db
      .prepare("SELECT * FROM kg_entities WHERE normalized_name = ? AND type = ?")
      .get(normalized, type) as EntityRow | undefined;

    if (existing) {
      this.db
        .prepare("UPDATE kg_entities SET mention_count = mention_count + 1, updated_at = ? WHERE id = ?")
        .run(timestamp, existing.id);

      if (docId) {
        this.addMention(existing.id, docId, null, 0);
      }

      return rowToEntity({
        ...existing,
        mention_count: existing.mention_count + 1,
        updated_at: timestamp,
      });
    }

    const id = generateId("ent");
    this.db
      .prepare(
        `INSERT INTO kg_entities (id, name, type, normalized_name, aliases, description, metadata, mention_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, '[]', NULL, '{}', 1, ?, ?)`,
      )
      .run(id, name, type, normalized, timestamp, timestamp);

    // Sync FTS — standalone FTS table, use auto-generated rowid
    const entityRowid = this.db
      .prepare("SELECT rowid FROM kg_entities WHERE id = ?")
      .get(id) as { rowid: number } | undefined;
    if (entityRowid) {
      this.db
        .prepare("INSERT INTO kg_entities_fts (rowid, name, aliases, description) VALUES (?, ?, '[]', '')")
        .run(entityRowid.rowid, name);
    }

    if (docId) {
      this.addMention(id, docId, null, 0);
    }

    logger.debug("entity-store:upsert", { id, name, type });

    return {
      id,
      name,
      type,
      normalizedName: normalized,
      aliases: [],
      description: null,
      metadata: {},
      mentionCount: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  /**
   * Add a relation between two entities.
   */
  addRelation(
    fromEntityId: string,
    toEntityId: string,
    relationType: EntityRelationType,
    weight: number = 1.0,
    sourceDocId: string | null = null,
  ): EntityRelation | null {
    const id = generateId("kgrel");
    const timestamp = now();

    try {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO kg_relations (id, from_entity_id, to_entity_id, relation_type, weight, source_doc_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, fromEntityId, toEntityId, relationType, weight, sourceDocId, timestamp);

      return {
        id,
        fromEntityId,
        toEntityId,
        relationType,
        weight,
        sourceDocId,
        createdAt: timestamp,
      };
    } catch {
      logger.debug("entity-store:relation-exists", { fromEntityId, toEntityId, relationType });
      return null;
    }
  }

  /**
   * Add a mention linking an entity to a knowledge document.
   */
  addMention(
    entityId: string,
    docId: string,
    context: string | null,
    position: number,
  ): EntityMention {
    const id = generateId("kgm");
    const timestamp = now();

    this.db
      .prepare(
        `INSERT INTO kg_mentions (id, entity_id, doc_id, context, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, entityId, docId, context, position, timestamp);

    return {
      id,
      entityId,
      docId,
      context,
      position,
      createdAt: timestamp,
    };
  }

  /**
   * Get entity by ID.
   */
  getById(id: string): Entity | undefined {
    const row = this.db
      .prepare("SELECT * FROM kg_entities WHERE id = ?")
      .get(id) as EntityRow | undefined;
    return row ? rowToEntity(row) : undefined;
  }

  /**
   * Find entities by FTS5 search on name, aliases, description.
   */
  findByName(query: string, limit: number = 10): Entity[] {
    if (!query.trim()) return [];

    try {
      // Try FTS5 prefix match first (append *)
      const ftsQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, "") + "*";
      const ftsRows = this.db
        .prepare(
          `SELECT e.* FROM kg_entities e
           JOIN kg_entities_fts fts ON e.rowid = fts.rowid
           WHERE kg_entities_fts MATCH ?
           LIMIT ?`,
        )
        .all(ftsQuery, limit) as EntityRow[];

      if (ftsRows.length > 0) {
        return ftsRows.map(rowToEntity);
      }
    } catch {
      // FTS query syntax error — fall through to LIKE
    }

    // Fallback to LIKE for substring matching
    const likeRows = this.db
      .prepare("SELECT * FROM kg_entities WHERE normalized_name LIKE ? OR name LIKE ? LIMIT ?")
      .all(`%${normalizeName(query)}%`, `%${query}%`, limit) as EntityRow[];
    return likeRows.map(rowToEntity);
  }

  /**
   * Get all relations from/to an entity.
   */
  getRelations(entityId: string): EntityRelation[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM kg_relations WHERE from_entity_id = ? OR to_entity_id = ?",
      )
      .all(entityId, entityId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  /**
   * Get relations originating from an entity.
   */
  getRelationsFrom(entityId: string): EntityRelation[] {
    const rows = this.db
      .prepare("SELECT * FROM kg_relations WHERE from_entity_id = ?")
      .all(entityId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  /**
   * Get relations pointing to an entity.
   */
  getRelationsTo(entityId: string): EntityRelation[] {
    const rows = this.db
      .prepare("SELECT * FROM kg_relations WHERE to_entity_id = ?")
      .all(entityId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  /**
   * Get all entities mentioned in a specific document.
   */
  getEntitiesForDoc(docId: string): Entity[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT e.* FROM kg_entities e
         JOIN kg_mentions m ON e.id = m.entity_id
         WHERE m.doc_id = ?`,
      )
      .all(docId) as EntityRow[];
    return rows.map(rowToEntity);
  }

  /**
   * Get all document IDs that mention an entity.
   */
  getDocIdsForEntity(entityId: string): string[] {
    const rows = this.db
      .prepare("SELECT DISTINCT doc_id FROM kg_mentions WHERE entity_id = ?")
      .all(entityId) as Array<{ doc_id: string }>;
    return rows.map((r) => r.doc_id);
  }

  /**
   * Get mentions for an entity.
   */
  getMentions(entityId: string): EntityMention[] {
    const rows = this.db
      .prepare("SELECT * FROM kg_mentions WHERE entity_id = ?")
      .all(entityId) as MentionRow[];
    return rows.map(rowToMention);
  }

  /**
   * BFS traversal from seed entities — extract subgraph up to maxDepth hops.
   * Returns entities, relations, and associated document IDs.
   * Caps at maxEntities to prevent unbounded growth.
   */
  extractSubgraph(
    seedEntityIds: string[],
    maxDepth: number = 2,
    maxEntities: number = 50,
  ): EntitySubgraph {
    const visited = new Set<string>();
    const collectedRelations = new Map<string, EntityRelation>();
    const docIdSet = new Set<string>();

    let frontier = seedEntityIds.filter((id) => {
      if (visited.has(id)) return false;
      visited.add(id);
      return true;
    });

    // Collect doc IDs for seeds
    for (const id of frontier) {
      for (const docId of this.getDocIdsForEntity(id)) {
        docIdSet.add(docId);
      }
    }

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      if (visited.size >= maxEntities) break;

      const nextFrontier: string[] = [];

      for (const entityId of frontier) {
        const relations = this.getRelations(entityId);

        for (const rel of relations) {
          collectedRelations.set(rel.id, rel);

          const neighborId = rel.fromEntityId === entityId
            ? rel.toEntityId
            : rel.fromEntityId;

          if (!visited.has(neighborId) && visited.size < maxEntities) {
            visited.add(neighborId);
            nextFrontier.push(neighborId);

            for (const docId of this.getDocIdsForEntity(neighborId)) {
              docIdSet.add(docId);
            }
          }
        }
      }

      frontier = nextFrontier;
    }

    // Fetch full entity objects
    const entities: Entity[] = [];
    for (const id of visited) {
      const entity = this.getById(id);
      if (entity) entities.push(entity);
    }

    logger.debug("entity-store:subgraph", {
      seeds: seedEntityIds.length,
      entities: entities.length,
      relations: collectedRelations.size,
      docs: docIdSet.size,
    });

    return {
      entities,
      relations: Array.from(collectedRelations.values()),
      docIds: Array.from(docIdSet),
    };
  }

  /**
   * Merge two entities — move all mentions and relations from mergeId to keepId,
   * then delete the merged entity.
   */
  mergeEntities(keepId: string, mergeId: string): void {
    this.db.transaction(() => {
      // Move mentions
      this.db
        .prepare("UPDATE kg_mentions SET entity_id = ? WHERE entity_id = ?")
        .run(keepId, mergeId);

      // Move outgoing relations (ignore duplicates)
      this.db
        .prepare(
          `UPDATE OR IGNORE kg_relations SET from_entity_id = ? WHERE from_entity_id = ?`,
        )
        .run(keepId, mergeId);

      // Move incoming relations (ignore duplicates)
      this.db
        .prepare(
          `UPDATE OR IGNORE kg_relations SET to_entity_id = ? WHERE to_entity_id = ?`,
        )
        .run(keepId, mergeId);

      // Delete orphaned relations that couldn't be moved (duplicates)
      this.db
        .prepare("DELETE FROM kg_relations WHERE from_entity_id = ? OR to_entity_id = ?")
        .run(mergeId, mergeId);

      // Update mention count on keeper
      const mentionCount = (this.db
        .prepare("SELECT COUNT(*) as cnt FROM kg_mentions WHERE entity_id = ?")
        .get(keepId) as { cnt: number }).cnt;
      this.db
        .prepare("UPDATE kg_entities SET mention_count = ?, updated_at = ? WHERE id = ?")
        .run(mentionCount, now(), keepId);

      // Delete FTS entry for merged entity
      const mergedRowid = this.db
        .prepare("SELECT rowid FROM kg_entities WHERE id = ?")
        .get(mergeId) as { rowid: number } | undefined;
      if (mergedRowid) {
        const merged = this.db
          .prepare("SELECT * FROM kg_entities WHERE id = ?")
          .get(mergeId) as EntityRow | undefined;
        if (merged) {
          this.db
            .prepare("DELETE FROM kg_entities_fts WHERE rowid = ?")
            .run(mergedRowid.rowid);
        }
      }

      // Delete merged entity
      this.db.prepare("DELETE FROM kg_entities WHERE id = ?").run(mergeId);

      logger.debug("entity-store:merge", { keepId, mergeId, mentionCount });
    })();
  }

  /**
   * Get stats for the knowledge graph.
   */
  stats(): { entities: number; relations: number; mentions: number } {
    const entities = (this.db
      .prepare("SELECT COUNT(*) as cnt FROM kg_entities")
      .get() as { cnt: number }).cnt;
    const relations = (this.db
      .prepare("SELECT COUNT(*) as cnt FROM kg_relations")
      .get() as { cnt: number }).cnt;
    const mentions = (this.db
      .prepare("SELECT COUNT(*) as cnt FROM kg_mentions")
      .get() as { cnt: number }).cnt;
    return { entities, relations, mentions };
  }

  /**
   * Clear all KG data (for reindexing).
   */
  clear(): void {
    this.db.transaction(() => {
      this.db.exec("DELETE FROM kg_mentions");
      this.db.exec("DELETE FROM kg_relations");
      this.db.exec("DELETE FROM kg_entities_fts");
      this.db.exec("DELETE FROM kg_entities");
    })();
  }
}
