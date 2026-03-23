/**
 * Knowledge Quality Engine — scores, decays, and tracks knowledge relevance.
 *
 * Quality score is a composite (0–1) based on:
 * - Freshness (0.3): exponential decay from created_at, half-life 30 days
 * - Source reliability (0.3): static weight per source_type
 * - Usage frequency (0.2): normalized usage_count (log scale)
 * - Content richness (0.2): content length relative to average
 */

import type Database from "better-sqlite3";
import type { KnowledgeDocument, KnowledgeSourceType } from "../../schemas/knowledge.schema.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

const FRESHNESS_WEIGHT = 0.3;
const RELIABILITY_WEIGHT = 0.3;
const USAGE_WEIGHT = 0.2;
const RICHNESS_WEIGHT = 0.2;

/** Half-life in days for freshness decay */
const FRESHNESS_HALF_LIFE_DAYS = 30;

/** Average content length baseline (chars) for richness scoring */
const AVG_CONTENT_LENGTH = 500;

const SOURCE_RELIABILITY: Record<string, number> = {
  docs: 0.9,
  prd: 0.85,
  memory: 0.8,
  skill: 0.75,
  web_capture: 0.7,
  sprint_plan: 0.7,
  code_context: 0.65,
  ai_decision: 0.6,
  validation_result: 0.6,
  synthesis: 0.55,
  phase_summary: 0.5,
};

/**
 * Get the reliability weight for a knowledge source type.
 */
export function getSourceReliabilityWeight(sourceType: KnowledgeSourceType): number {
  return SOURCE_RELIABILITY[sourceType] ?? 0.5;
}

/**
 * Calculate a composite quality score (0–1) for a knowledge document.
 */
export function calculateQualityScore(doc: KnowledgeDocument): number {
  const freshness = calculateFreshness(doc.createdAt);
  const reliability = getSourceReliabilityWeight(doc.sourceType);
  const usage = calculateUsageScore(doc.usageCount ?? 0);
  const richness = calculateRichness(doc.content);

  const score =
    FRESHNESS_WEIGHT * freshness +
    RELIABILITY_WEIGHT * reliability +
    USAGE_WEIGHT * usage +
    RICHNESS_WEIGHT * richness;

  return Math.max(0, Math.min(1, score));
}

/**
 * Freshness score: exponential decay with 30-day half-life.
 * Returns 1.0 for brand-new docs, 0.5 at 30 days, ~0.25 at 60 days.
 */
function calculateFreshness(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = Math.max(0, ageMs / (24 * 60 * 60 * 1000));
  return Math.pow(0.5, ageDays / FRESHNESS_HALF_LIFE_DAYS);
}

/**
 * Usage score: logarithmic scale. More usage = higher score, with diminishing returns.
 * 0 usage → 0.0, 1 usage → 0.5, 10 usage → 0.83, 100 usage → 1.0
 */
function calculateUsageScore(usageCount: number): number {
  if (usageCount <= 0) return 0;
  return Math.min(1, Math.log10(usageCount + 1) / 2);
}

/**
 * Content richness score: longer content scores higher, up to a cap.
 */
function calculateRichness(content: string): number {
  const ratio = content.length / AVG_CONTENT_LENGTH;
  return Math.min(1, ratio);
}

/**
 * Calculate staleness in days from a date string.
 */
function calculateStalenessDays(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
}

/**
 * Record a usage event for a knowledge document.
 * Inserts into knowledge_usage_log and increments usage_count + last_accessed_at.
 */
export function recordUsage(
  db: Database.Database,
  docId: string,
  query: string,
  action: string,
  context?: Record<string, unknown>,
): void {
  const timestamp = now();

  db.prepare(
    "INSERT INTO knowledge_usage_log (doc_id, query, action, context, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(docId, query, action, context ? JSON.stringify(context) : null, timestamp);

  db.prepare(
    "UPDATE knowledge_documents SET usage_count = usage_count + 1, last_accessed_at = ? WHERE id = ?",
  ).run(timestamp, docId);

  logger.debug("Knowledge usage recorded", { docId, action });
}

/**
 * Batch update staleness_days and quality_score for all knowledge documents.
 */
export function decayStaleKnowledge(db: Database.Database): { updated: number } {
  const rows = db
    .prepare("SELECT id, source_type, content, content_hash, created_at, usage_count FROM knowledge_documents")
    .all() as Array<{
      id: string;
      source_type: string;
      content: string;
      content_hash: string;
      created_at: string;
      usage_count: number;
    }>;

  const update = db.prepare(
    "UPDATE knowledge_documents SET staleness_days = ?, quality_score = ? WHERE id = ?",
  );

  let updated = 0;
  db.transaction(() => {
    for (const row of rows) {
      const stalenessDays = calculateStalenessDays(row.created_at);
      const doc: KnowledgeDocument = {
        id: row.id,
        sourceType: row.source_type as KnowledgeSourceType,
        sourceId: "",
        title: "",
        content: row.content,
        contentHash: row.content_hash,
        chunkIndex: 0,
        createdAt: row.created_at,
        updatedAt: row.created_at,
        usageCount: row.usage_count,
      };
      const qualityScore = calculateQualityScore(doc);
      update.run(stalenessDays, qualityScore, row.id);
      updated++;
    }
  })();

  logger.info("Knowledge staleness decay completed", { updated });
  return { updated };
}
