/**
 * Universal Construct Registry — SQLite CRUD + queries.
 * Uses the shared Database instance from SqliteStore.
 */

import type Database from "better-sqlite3";
import type {
  UcrCategory,
  UcrConstruct,
  UcrLanguageMapping,
  UcrSeedData,
} from "./construct-types.js";
import { logger } from "../../utils/logger.js";

// ── Row types (SQLite ↔ JS) ─────────────────────────────

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
}

interface ConstructRow {
  id: string;
  category_id: string;
  canonical_name: string;
  description: string | null;
  semantic_group: string | null;
  metadata: string | null;
}

interface MappingRow {
  id: string;
  construct_id: string;
  language_id: string;
  syntax_pattern: string;
  ast_node_type: string | null;
  confidence: number;
  is_primary: number;
  constraints: string | null;
}

// ── Mappers ──────────────────────────────────────────────

function rowToCategory(row: CategoryRow): UcrCategory {
  return {
    id: row.id,
    name: row.name,
    ...(row.description != null && { description: row.description }),
  };
}

function rowToConstruct(row: ConstructRow): UcrConstruct {
  return {
    id: row.id,
    categoryId: row.category_id,
    canonicalName: row.canonical_name,
    ...(row.description != null && { description: row.description }),
    ...(row.semantic_group != null && { semanticGroup: row.semantic_group }),
    ...(row.metadata != null && { metadata: JSON.parse(row.metadata) as Record<string, unknown> }),
  };
}

function rowToMapping(row: MappingRow): UcrLanguageMapping {
  return {
    id: row.id,
    constructId: row.construct_id,
    languageId: row.language_id,
    syntaxPattern: row.syntax_pattern,
    ...(row.ast_node_type != null && { astNodeType: row.ast_node_type }),
    confidence: row.confidence,
    isPrimary: row.is_primary === 1,
    ...(row.constraints != null && { constraints: JSON.parse(row.constraints) as Record<string, unknown> }),
  };
}

// ── Translation Path result ──────────────────────────────

export interface TranslationPathResult {
  sourceMapping: UcrLanguageMapping;
  targetMapping: UcrLanguageMapping;
  confidence: number;
  alternatives: UcrLanguageMapping[];
}

// ── Seed result ──────────────────────────────────────────

export interface SeedResult {
  categories: number;
  constructs: number;
  mappings: number;
}

// ── Registry class ───────────────────────────────────────

export class ConstructRegistry {
  constructor(private readonly db: Database.Database) {}

  // ── Categories ──────────────────────────────────────────

  insertCategory(cat: UcrCategory): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO ucr_categories (id, name, description)
      VALUES (?, ?, ?)
    `).run(cat.id, cat.name, cat.description ?? null);
  }

  getCategory(id: string): UcrCategory | null {
    const row = this.db.prepare("SELECT * FROM ucr_categories WHERE id = ?").get(id) as CategoryRow | undefined;
    return row ? rowToCategory(row) : null;
  }

  listCategories(): UcrCategory[] {
    const rows = this.db.prepare("SELECT * FROM ucr_categories ORDER BY name").all() as CategoryRow[];
    return rows.map(rowToCategory);
  }

  // ── Constructs ──────────────────────────────────────────

  insertConstruct(construct: UcrConstruct): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO ucr_constructs (id, category_id, canonical_name, description, semantic_group, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      construct.id,
      construct.categoryId,
      construct.canonicalName,
      construct.description ?? null,
      construct.semanticGroup ?? null,
      construct.metadata ? JSON.stringify(construct.metadata) : null,
    );
  }

  getConstruct(canonicalName: string): UcrConstruct | null {
    const row = this.db.prepare("SELECT * FROM ucr_constructs WHERE canonical_name = ?").get(canonicalName) as ConstructRow | undefined;
    return row ? rowToConstruct(row) : null;
  }

  getConstructById(id: string): UcrConstruct | null {
    const row = this.db.prepare("SELECT * FROM ucr_constructs WHERE id = ?").get(id) as ConstructRow | undefined;
    return row ? rowToConstruct(row) : null;
  }

  getConstructsByCategory(categoryId: string): UcrConstruct[] {
    const rows = this.db.prepare("SELECT * FROM ucr_constructs WHERE category_id = ? ORDER BY canonical_name").all(categoryId) as ConstructRow[];
    return rows.map(rowToConstruct);
  }

  searchConstructs(query: string): UcrConstruct[] {
    const sanitized = query.replace(/['"]/g, "").trim();
    if (!sanitized) return [];

    const rows = this.db.prepare(`
      SELECT c.* FROM ucr_constructs c
      WHERE c.canonical_name LIKE ? OR c.description LIKE ? OR c.semantic_group LIKE ?
      ORDER BY c.canonical_name
      LIMIT 50
    `).all(`%${sanitized}%`, `%${sanitized}%`, `%${sanitized}%`) as ConstructRow[];
    return rows.map(rowToConstruct);
  }

  // ── Language Mappings ───────────────────────────────────

  insertMapping(mapping: UcrLanguageMapping): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO ucr_language_mappings (id, construct_id, language_id, syntax_pattern, ast_node_type, confidence, is_primary, constraints)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mapping.id,
      mapping.constructId,
      mapping.languageId,
      mapping.syntaxPattern,
      mapping.astNodeType ?? null,
      mapping.confidence,
      mapping.isPrimary ? 1 : 0,
      mapping.constraints ? JSON.stringify(mapping.constraints) : null,
    );
  }

  getMappings(constructId: string, languageId: string): UcrLanguageMapping[] {
    const rows = this.db.prepare(`
      SELECT * FROM ucr_language_mappings
      WHERE construct_id = ? AND language_id = ?
      ORDER BY is_primary DESC, confidence DESC
    `).all(constructId, languageId) as MappingRow[];
    return rows.map(rowToMapping);
  }

  getPrimaryMapping(constructId: string, languageId: string): UcrLanguageMapping | null {
    const row = this.db.prepare(`
      SELECT * FROM ucr_language_mappings
      WHERE construct_id = ? AND language_id = ? AND is_primary = 1
      ORDER BY confidence DESC
      LIMIT 1
    `).get(constructId, languageId) as MappingRow | undefined;
    return row ? rowToMapping(row) : null;
  }

  // ── Translation Path ───────────────────────────────────

  findTranslationPath(constructId: string, sourceLang: string, targetLang: string): TranslationPathResult | null {
    const sourceMapping = this.getPrimaryMapping(constructId, sourceLang);
    if (!sourceMapping) return null;

    const targetMapping = this.getPrimaryMapping(constructId, targetLang);
    if (!targetMapping) return null;

    const allTargetMappings = this.getMappings(constructId, targetLang);
    const alternatives = allTargetMappings.filter((m) => m.id !== targetMapping.id);

    const confidence = Math.min(sourceMapping.confidence, targetMapping.confidence);

    return { sourceMapping, targetMapping, confidence, alternatives };
  }

  // ── Confidence Update ──────────────────────────────────

  updateConfidence(mappingId: string, delta: number): void {
    this.db.prepare(`
      UPDATE ucr_language_mappings
      SET confidence = MIN(1.0, MAX(0.0, confidence + ?))
      WHERE id = ?
    `).run(delta, mappingId);
  }

  // ── Seed ───────────────────────────────────────────────

  seedFromJson(data: UcrSeedData): SeedResult {
    const result: SeedResult = { categories: 0, constructs: 0, mappings: 0 };

    const tx = this.db.transaction(() => {
      for (const cat of data.categories) {
        this.insertCategory(cat);
        result.categories++;
      }
      for (const construct of data.constructs) {
        this.insertConstruct(construct);
        result.constructs++;
      }
      for (const mapping of data.mappings) {
        this.insertMapping(mapping);
        result.mappings++;
      }
    });

    tx();

    logger.info("ucr:seed", {
      categories: result.categories,
      constructs: result.constructs,
      mappings: result.mappings,
    });

    return result;
  }
}
