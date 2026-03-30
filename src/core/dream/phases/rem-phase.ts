/**
 * REM Phase — Priority Processing + Merge + Association Strengthening
 *
 * Biological basis:
 * - Emotional Memory Processing (Stickgold 2005): amygdala selectively
 *   strengthens priority memories while decoupling emotional charge.
 * - Pattern Integration (McClelland 1995): complementary learning systems
 *   merge similar representations across stores.
 * - Theta Oscillations (Buzsáki 2002): co-accessed items get their
 *   associations strengthened via phase-coupled binding.
 */

import type Database from "better-sqlite3";
import type { DreamCycleConfig, RemPhaseResult } from "../dream-types.js";
import { linkBySharedContext } from "../../rag/knowledge-linker.js";
import { logger } from "../../utils/logger.js";

interface DocRow {
  id: string;
  quality_score: number | null;
  metadata: string | null;
}

/**
 * Run the REM phase of a dream cycle.
 *
 * 1. Priority Processing: boost blocker/error docs, decay urgency
 * 2. Merge: find and merge highly similar docs (placeholder for embedding-based merge)
 * 3. Association: strengthen links between co-accessed docs
 */
export function runRemPhase(
  db: Database.Database,
  config: DreamCycleConfig,
  _cycleId: string,
): RemPhaseResult {
  const startMs = Date.now();

  // ── 1. Priority Processing ──────────────────────────────
  const { priorityProcessed, urgencyDecayed } = processPriorityDocs(db, config);

  // ── 2. Merge (semantic similarity — simplified without embedding store) ──
  // Full merge requires EmbeddingStore.findSimilar() which needs loaded embeddings.
  // For now, count 0 — will be activated when DreamEngine provides EmbeddingStore.
  const merged = 0;
  const clustersFormed = 0;

  // ── 3. Association Strengthening ───────────────────────
  let associationsCreated = 0;
  if (!config.dryRun) {
    const linkResult = linkBySharedContext(db);
    associationsCreated = linkResult.relationsCreated;
  }

  const durationMs = Date.now() - startMs;
  logger.info("dream:rem:complete", { priorityProcessed, urgencyDecayed, merged, associationsCreated, durationMs });

  return { priorityProcessed, urgencyDecayed, merged, clustersFormed, associationsCreated, durationMs };
}

/**
 * Priority Processing: find docs with metadata.priority = "blocker" or "error".
 * Boost their quality_score by +0.15 (capped at 1.0).
 * Decay urgency metadata field by urgencyDecayFactor.
 */
function processPriorityDocs(
  db: Database.Database,
  config: DreamCycleConfig,
): { priorityProcessed: number; urgencyDecayed: number } {
  const docs = db
    .prepare("SELECT id, quality_score, metadata FROM knowledge_documents WHERE metadata IS NOT NULL")
    .all() as DocRow[];

  let priorityProcessed = 0;
  let urgencyDecayed = 0;

  const updateScore = db.prepare("UPDATE knowledge_documents SET quality_score = ? WHERE id = ?");
  const updateMeta = db.prepare("UPDATE knowledge_documents SET metadata = ? WHERE id = ?");

  db.transaction(() => {
    for (const doc of docs) {
      if (!doc.metadata) continue;

      let meta: Record<string, unknown>;
      try {
        meta = JSON.parse(doc.metadata) as Record<string, unknown>;
      } catch {
        continue;
      }

      const priority = meta.priority as string | undefined;

      // Boost quality for priority items
      if (priority === "blocker" || priority === "error") {
        const currentScore = doc.quality_score ?? 0.5;
        const boostedScore = Math.min(1.0, currentScore + 0.15);
        if (!config.dryRun) {
          updateScore.run(boostedScore, doc.id);
        }
        priorityProcessed++;
      }

      // Decay urgency field
      if (typeof meta.urgency === "number" && meta.urgency > 0) {
        meta.urgency = meta.urgency * config.urgencyDecayFactor;
        if (!config.dryRun) {
          updateMeta.run(JSON.stringify(meta), doc.id);
        }
        urgencyDecayed++;
      }
    }
  })();

  logger.debug("dream:rem:priority", { priorityProcessed, urgencyDecayed });
  return { priorityProcessed, urgencyDecayed };
}
