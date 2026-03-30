/**
 * NREM Phase — Memory Replay + Synaptic Homeostasis + Pruning
 *
 * Biological basis:
 * - Memory Replay (Wilson & McNaughton 1994): hippocampal neurons replay
 *   experiences during sleep, strengthening important traces.
 * - Synaptic Homeostasis (Tononi & Cirelli 2014): proportional downscaling
 *   of all synaptic strengths during slow-wave sleep.
 * - Synaptic Pruning: weak connections below threshold are eliminated.
 */

import type Database from "better-sqlite3";
import type { DreamCycleConfig, NremPhaseResult } from "../dream-types.js";
import { archiveDreamDoc } from "../dream-store.js";
import { decayStaleKnowledge } from "../../rag/knowledge-quality.js";
import { logger } from "../../utils/logger.js";
import { generateId } from "../../utils/id.js";

interface DocRow {
  id: string;
  title: string;
  source_type: string;
  quality_score: number | null;
  created_at: string;
}

/**
 * Run the NREM phase of a dream cycle.
 *
 * 1. Replay: refresh access timestamps on recent high-quality docs
 * 2. Decay: proportionally downscale all quality scores
 * 3. Prune: archive + delete docs below threshold
 */
export function runNremPhase(
  db: Database.Database,
  config: DreamCycleConfig,
  cycleId: string,
): NremPhaseResult {
  const startMs = Date.now();

  // ── 1. Memory Replay ───────────────────────────────────
  const replayed = replayRecentDocs(db, config);

  // ── 2. Synaptic Homeostasis (decay) ────────────────────
  const { updated: scoresDecayed } = decayStaleKnowledge(db);

  // ── 3. Pruning ─────────────────────────────────────────
  const { pruned, archived } = pruneBelowThreshold(db, config, cycleId);

  const durationMs = Date.now() - startMs;
  logger.info("dream:nrem:complete", { replayed, scoresDecayed, pruned, archived, durationMs });

  return { replayed, scoresDecayed, pruned, archived, durationMs };
}

/**
 * Memory Replay: query docs created in the last 7 days with quality >= 0.6,
 * limited to maxReplayBatch. Update their last_accessed_at and increment
 * usage_count to strengthen their trace.
 */
function replayRecentDocs(db: Database.Database, config: DreamCycleConfig): number {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const docs = db
    .prepare(
      `SELECT id FROM knowledge_documents
       WHERE created_at >= ? AND quality_score >= 0.6
       ORDER BY quality_score DESC
       LIMIT ?`,
    )
    .all(sevenDaysAgo, config.maxReplayBatch) as Array<{ id: string }>;

  if (docs.length === 0) return 0;

  const update = db.prepare(
    "UPDATE knowledge_documents SET last_accessed_at = ?, usage_count = usage_count + 1 WHERE id = ?",
  );

  db.transaction(() => {
    for (const doc of docs) {
      update.run(now, doc.id);
    }
  })();

  logger.debug("dream:nrem:replay", { count: docs.length });
  return docs.length;
}

/**
 * Pruning: find docs with quality_score below threshold, archive them
 * to dream_archive, then delete from knowledge_documents.
 * In dry-run mode, counts but does not delete.
 */
function pruneBelowThreshold(
  db: Database.Database,
  config: DreamCycleConfig,
  cycleId: string,
): { pruned: number; archived: number } {
  const docs = db
    .prepare(
      `SELECT id, title, source_type, quality_score, created_at
       FROM knowledge_documents
       WHERE quality_score IS NOT NULL AND quality_score < ?`,
    )
    .all(config.pruneThreshold) as DocRow[];

  if (docs.length === 0) return { pruned: 0, archived: 0 };

  const now = new Date().toISOString();
  let archived = 0;

  if (!config.dryRun) {
    db.transaction(() => {
      for (const doc of docs) {
        archiveDreamDoc(db, {
          id: generateId("darch"),
          originalDocId: doc.id,
          title: doc.title,
          sourceType: doc.source_type,
          qualityScore: doc.quality_score,
          reason: "pruned",
          archivedAt: now,
          cycleId,
        });
        db.prepare("DELETE FROM knowledge_documents WHERE id = ?").run(doc.id);
        archived++;
      }
    })();
  } else {
    archived = docs.length; // count what would be archived
  }

  logger.debug("dream:nrem:prune", { pruned: docs.length, archived, dryRun: config.dryRun });
  return { pruned: docs.length, archived };
}
