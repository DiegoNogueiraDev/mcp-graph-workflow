/**
 * Query Understanding — preprocesses user queries before retrieval.
 *
 * Provides:
 * - Intent detection (search, how_to, status, debug, compare, history)
 * - Entity extraction (PascalCase, camelCase from query)
 * - Source type filtering (detect "in the PRD", "in code", etc.)
 * - Query expansion with related terms
 * - Query rewriting for FTS5 optimization
 */

import type Database from "better-sqlite3";
import { tokenize } from "../search/tokenizer.js";
import { extractEntities } from "./enrichment-pipeline.js";
import { extractEntitiesFromText } from "./entity-extractor.js";
import { EntityStore } from "./entity-store.js";
import { logger } from "../utils/logger.js";

export type QueryIntent = "search" | "how_to" | "status" | "debug" | "compare" | "history";

export interface UnderstandingResult {
  originalQuery: string;
  rewrittenQuery: string;
  entities: string[];
  intent: QueryIntent;
  expandedTerms: string[];
  sourceTypeFilter: string[];
}

// ── Intent detection patterns ────────────────────────────

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: QueryIntent }> = [
  { pattern: /^how\b|como\s+(fazer|funciona|implementar)/i, intent: "how_to" },
  { pattern: /\b(status|progress|progresso|sprint|burndown|velocity)\b/i, intent: "status" },
  { pattern: /\b(error|erro|bug|fail|falha|why\s+does|por\s*que)\b/i, intent: "debug" },
  { pattern: /\b(compare|compar|vs\.?|versus|difference|diferença|diferenca)\b/i, intent: "compare" },
  { pattern: /\b(history|histórico|historico|changelog|when\s+was|quando)\b/i, intent: "history" },
];

/**
 * Detect the intent of a query from keyword patterns.
 */
export function detectIntent(query: string): QueryIntent {
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(query)) return intent;
  }
  return "search";
}

// ── Source type detection patterns ────────────────────────

const SOURCE_PATTERNS: Array<{ pattern: RegExp; sourceTypes: string[] }> = [
  { pattern: /\b(code|código|codigo|symbol|function|class|módulo|modulo)\b/i, sourceTypes: ["code_context"] },
  { pattern: /\b(prd|requisito|requirement|user\s+stor)/i, sourceTypes: ["prd"] },
  { pattern: /\b(journey|jornada|screen|tela|fluxo|flow)\b/i, sourceTypes: ["journey"] },
  { pattern: /\b(skills?|habilidade)\b/i, sourceTypes: ["skill"] },
  { pattern: /\b(doc|docs|documentation|documentação|documentacao|library|lib)\b/i, sourceTypes: ["docs"] },
  { pattern: /\b(memory|memória|memoria|decision|decisão|decisao)\b/i, sourceTypes: ["memory", "ai_decision"] },
  { pattern: /\b(siebel|sif|composer)\b/i, sourceTypes: ["siebel_sif", "siebel_composer", "siebel_docs"] },
  { pattern: /\b(benchmark|performance|latency|latência|token\s+economy)\b/i, sourceTypes: ["benchmark"] },
  { pattern: /\b(capture|screenshot|web\s+page|página|pagina)\b/i, sourceTypes: ["web_capture"] },
  { pattern: /\b(swagger|api\s+spec|openapi|endpoint)\b/i, sourceTypes: ["swagger"] },
];

/**
 * Detect source type filters from query content.
 */
export function detectSourceFilter(query: string): string[] {
  const filters = new Set<string>();
  for (const { pattern, sourceTypes } of SOURCE_PATTERNS) {
    if (pattern.test(query)) {
      for (const st of sourceTypes) filters.add(st);
    }
  }
  return Array.from(filters);
}

// ── Query expansion ──────────────────────────────────────

const EXPANSION_MAP: Record<string, string[]> = {
  database: ["sqlite", "store", "migration", "schema"],
  migration: ["database", "schema", "version", "upgrade"],
  search: ["fts5", "bm25", "query", "ranking"],
  context: ["rag", "token", "budget", "tiered"],
  graph: ["node", "edge", "dependency", "traversal"],
  parser: ["segment", "classify", "extract", "normalize"],
  chunk: ["split", "overlap", "token", "sentence"],
  embedding: ["tfidf", "vector", "cosine", "similarity"],
  knowledge: ["store", "document", "index", "rag"],
  node: ["task", "epic", "status", "dependency"],
  test: ["vitest", "tdd", "assertion", "mock"],
  skill: ["phase", "lifecycle", "recommend"],
};

/**
 * Expand query tokens with related technical terms.
 */
export function expandQuery(query: string): string[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const expanded = new Set(tokens);
  for (const token of tokens) {
    const related = EXPANSION_MAP[token];
    if (related) {
      for (const term of related) expanded.add(term);
    }
  }
  return Array.from(expanded);
}

/**
 * Rewrite query for FTS5 — clean, tokenize, rejoin.
 */
function rewriteQuery(query: string): string {
  const tokens = tokenize(query);
  return tokens.join(" ");
}

/**
 * Full query understanding pipeline.
 * Analyzes a natural language query and returns structured understanding.
 */
export function understandQuery(query: string): UnderstandingResult {
  const originalQuery = query;
  const intent = detectIntent(query);
  const entities = extractEntities(query);
  const sourceTypeFilter = detectSourceFilter(query);
  const expandedTerms = expandQuery(query);
  const rewrittenQuery = rewriteQuery(query);

  logger.debug("Query understood", {
    intent,
    entityCount: entities.length,
    sourceFilters: sourceTypeFilter.length,
    expandedTermCount: expandedTerms.length,
  });

  return {
    originalQuery,
    rewrittenQuery,
    entities,
    intent,
    expandedTerms,
    sourceTypeFilter,
  };
}

// ── Decomposed Query (Knowledge Graph-aware) ─────────────

export interface EntityMatch {
  entityId: string;
  name: string;
  type: string;
  score: number;
}

export interface DecomposedQuery extends UnderstandingResult {
  /** High-level keys: intent + abstract concepts (expanded terms) */
  highLevelKeys: string[];
  /** Low-level keys: specific entities and technical terms */
  lowLevelKeys: string[];
  /** Entities matched from the Knowledge Graph */
  entityMatches: EntityMatch[];
}

/**
 * Decompose query into high/low level keys with KG entity matching.
 * Extends understandQuery() — the original function is NOT modified.
 *
 * If the KG tables don't exist or are empty, entityMatches will be [].
 * This ensures graceful degradation when KG is not populated.
 */
export function decomposeQuery(query: string, db: Database.Database): DecomposedQuery {
  const base = understandQuery(query);

  // High-level keys: intent + expanded terms (abstract concepts)
  const highLevelKeys = [base.intent, ...base.expandedTerms];

  // Low-level keys: extracted entities from the query text (specific terms)
  const queryEntities = extractEntitiesFromText(query);
  const lowLevelKeys = [
    ...base.entities,
    ...queryEntities.map((e) => e.name),
  ];
  // Deduplicate
  const uniqueLowKeys = [...new Set(lowLevelKeys)];

  // Match against Knowledge Graph entities
  const entityMatches: EntityMatch[] = [];

  try {
    const entityStore = new EntityStore(db);
    if (entityStore.hasKgTables()) {
      // Search KG for each extracted entity name
      const searched = new Set<string>();
      for (const key of uniqueLowKeys) {
        if (searched.has(key.toLowerCase())) continue;
        searched.add(key.toLowerCase());

        const matches = entityStore.findByName(key, 3);
        for (const match of matches) {
          // Score: exact match = 1.0, partial = 0.6
          const score = match.normalizedName === key.toLowerCase() ? 1.0 : 0.6;
          entityMatches.push({
            entityId: match.id,
            name: match.name,
            type: match.type,
            score,
          });
        }
      }

      // Also try expanded terms against KG
      for (const term of base.expandedTerms) {
        if (searched.has(term.toLowerCase())) continue;
        searched.add(term.toLowerCase());

        const matches = entityStore.findByName(term, 2);
        for (const match of matches) {
          entityMatches.push({
            entityId: match.id,
            name: match.name,
            type: match.type,
            score: 0.4, // Lower score for expanded term matches
          });
        }
      }
    }
  } catch {
    // KG not available — graceful degradation
    logger.debug("decomposeQuery: KG tables not available, skipping entity matching");
  }

  // Deduplicate entity matches by entityId, keeping highest score
  const entityMap = new Map<string, EntityMatch>();
  for (const em of entityMatches) {
    const existing = entityMap.get(em.entityId);
    if (!existing || em.score > existing.score) {
      entityMap.set(em.entityId, em);
    }
  }

  logger.debug("Query decomposed", {
    highLevelKeys: highLevelKeys.length,
    lowLevelKeys: uniqueLowKeys.length,
    entityMatches: entityMap.size,
  });

  return {
    ...base,
    highLevelKeys,
    lowLevelKeys: uniqueLowKeys,
    entityMatches: Array.from(entityMap.values()).sort((a, b) => b.score - a.score),
  };
}
