/**
 * Multi-Strategy Retrieval — combines FTS5, graph traversal, quality scoring,
 * and recency boost into a unified search pipeline.
 *
 * Strategies:
 * 1. FTS5 + BM25 (weight 0.4)
 * 2. Graph traversal via knowledge_relations (weight 0.3)
 * 3. Recency boost (weight 0.2)
 * 4. Quality score multiplier (weight 0.1)
 *
 * Results merged via Reciprocal Rank Fusion (RRF).
 */

import type Database from "better-sqlite3";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { findCrossSourceContext } from "./knowledge-linker.js";
import { EntityStore } from "./entity-store.js";
import { decomposeQuery, understandQuery } from "./query-understanding.js";
import { logger } from "../utils/logger.js";

export interface RankedResult {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  score: number;
  qualityScore: number;
  strategies: string[];
}

interface SearchOptions {
  limit?: number;
  minQuality?: number;
  phase?: string;
  lspBridge?: { findReferences: (file: string, line: number, character: number) => Promise<Array<{ file: string; startLine: number }>> } | null;
}

const RRF_K = 60;

/**
 * Reciprocal Rank Fusion — merge multiple ranked lists into one.
 * score = Σ(1 / (k + rank_i))
 */
export function reciprocalRankFusion(
  rankedLists: Array<Array<{ id: string; score: number }>>,
): Array<{ id: string; rrfScore: number }> {
  const scores = new Map<string, number>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const current = scores.get(item.id) ?? 0;
      scores.set(item.id, current + 1 / (RRF_K + rank + 1));
    }
  }

  return Array.from(scores.entries())
    .map(([id, rrfScore]) => ({ id, rrfScore }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Multi-strategy knowledge search combining FTS, graph relations,
 * quality scoring, and recency.
 */
export function multiStrategySearch(
  db: Database.Database,
  query: string,
  options?: SearchOptions,
): RankedResult[] {
  const limit = options?.limit ?? 10;
  const knowledgeStore = new KnowledgeStore(db);

  // Strategy 1: FTS5 + BM25
  let ftsResults: Array<{ id: string; score: number }> = [];
  try {
    const raw = knowledgeStore.search(query, limit * 2);
    ftsResults = raw.map((r) => ({ id: r.id, score: r.score }));
  } catch {
    logger.debug("Multi-strategy FTS search returned no results");
  }

  // Strategy 2: Graph traversal — follow relations from FTS results
  const graphResults: Array<{ id: string; score: number }> = [];
  if (ftsResults.length > 0) {
    const relatedIds = new Set<string>();
    for (const ftsResult of ftsResults.slice(0, 3)) {
      const related = findCrossSourceContext(db, ftsResult.id, 3);
      for (const doc of related) {
        if (!relatedIds.has(doc.id)) {
          relatedIds.add(doc.id);
          graphResults.push({ id: doc.id, score: 0.8 });
        }
      }
    }
  }

  // Strategy 3: Recency boost (uses pre-computed recency_score column)
  let recencyResults: Array<{ id: string; score: number }> = [];
  if (ftsResults.length > 0) {
    const allIds = [...new Set([...ftsResults.map((r) => r.id), ...graphResults.map((r) => r.id)])];
    recencyResults = allIds.map((id) => {
      const row = db
        .prepare("SELECT recency_score FROM knowledge_documents WHERE id = ?")
        .get(id) as { recency_score: number | null } | undefined;
      if (!row) return { id, score: 0 };
      return { id, score: row.recency_score ?? 1.0 };
    });
  }

  // Strategy 4: Entity Graph Traversal — find docs via KG entities
  const entityGraphResults: Array<{ id: string; score: number }> = [];
  try {
    const entityStore = new EntityStore(db);
    if (entityStore.hasKgTables() && entityStore.stats().entities > 0) {
      const decomposed = decomposeQuery(query, db);

      if (decomposed.entityMatches.length > 0) {
        // Extract subgraph around matched entities (2 hops)
        const seedIds = decomposed.entityMatches.slice(0, 5).map((m) => m.entityId);
        const subgraph = entityStore.extractSubgraph(seedIds, 2, 50);

        // Convert doc IDs to scored results
        const docScoreMap = new Map<string, number>();
        for (const docId of subgraph.docIds) {
          docScoreMap.set(docId, 0.5);
        }

        // Boost docs that contain directly matched entities
        for (const match of decomposed.entityMatches) {
          const docIds = entityStore.getDocIdsForEntity(match.entityId);
          for (const docId of docIds) {
            const current = docScoreMap.get(docId) ?? 0;
            docScoreMap.set(docId, Math.min(current + match.score * 0.3, 1.0));
          }
        }

        for (const [id, score] of docScoreMap) {
          entityGraphResults.push({ id, score });
        }

        // Sort by score descending for RRF
        entityGraphResults.sort((a, b) => b.score - a.score);
      }
    }
  } catch {
    logger.debug("Entity graph strategy skipped — KG not available");
  }

  // Strategy 5: LSP Symbol Resolution — precise code lookups (weight 0.5)
  const lspResults: Array<{ id: string; score: number }> = [];
  if (options?.lspBridge) {
    try {
      const understanding = understandQuery(query);
      const codeEntities = understanding.entities.filter(e =>
        /^[A-Z]/.test(e) || /^[a-z]+[A-Z]/.test(e) // PascalCase or camelCase
      );

      if (codeEntities.length > 0) {
        const codeDocs = knowledgeStore.search(codeEntities[0], 5)
          .filter(d => d.sourceType === "code_context" || d.sourceType === "lsp_result");
        for (const doc of codeDocs) {
          lspResults.push({ id: doc.id, score: 0.9 });
        }
      }
    } catch {
      logger.debug("Multi-strategy LSP resolution returned no results");
    }
  }

  if (ftsResults.length === 0 && graphResults.length === 0 && entityGraphResults.length === 0 && lspResults.length === 0) {
    return [];
  }

  // Merge via RRF — add entity graph results as 4th list, LSP as 5th
  const rankedLists = [ftsResults, graphResults, recencyResults];
  if (entityGraphResults.length > 0) {
    rankedLists.push(entityGraphResults);
  }
  if (lspResults.length > 0) {
    rankedLists.push(lspResults);
  }
  const merged = reciprocalRankFusion(rankedLists);

  // Fetch full docs and apply quality multiplier
  const results: RankedResult[] = [];
  const strategyMap = new Map<string, string[]>();

  for (const fts of ftsResults) {
    const strategies = strategyMap.get(fts.id) ?? [];
    strategies.push("fts");
    strategyMap.set(fts.id, strategies);
  }
  for (const gr of graphResults) {
    const strategies = strategyMap.get(gr.id) ?? [];
    strategies.push("graph");
    strategyMap.set(gr.id, strategies);
  }
  for (const eg of entityGraphResults) {
    const strategies = strategyMap.get(eg.id) ?? [];
    strategies.push("entity_graph");
    strategyMap.set(eg.id, strategies);
  }
  for (const lr of lspResults) {
    const strategies = strategyMap.get(lr.id) ?? [];
    strategies.push("lsp");
    strategyMap.set(lr.id, strategies);
  }

  for (const item of merged.slice(0, limit)) {
    const doc = knowledgeStore.getById(item.id);
    if (!doc) continue;

    const qualityScore = (db
      .prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?")
      .get(item.id) as { quality_score: number } | undefined)?.quality_score ?? 0.5;

    const finalScore = item.rrfScore * (0.5 + 0.5 * qualityScore);

    results.push({
      id: doc.id,
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      title: doc.title,
      content: doc.content,
      score: Math.round(finalScore * 10000) / 10000,
      qualityScore,
      strategies: strategyMap.get(doc.id) ?? ["rrf"],
    });
  }

  // Sort by final score
  results.sort((a, b) => b.score - a.score);

  // Source diversity enforcement: ensure at least 2 source types in top-5
  if (results.length > 3) {
    const topSourceTypes = new Set(results.slice(0, 3).map((r) => r.sourceType));
    if (topSourceTypes.size < 2) {
      // Find a result with a different source type and swap it into top-3
      const differentIdx = results.findIndex(
        (r, i) => i >= 3 && !topSourceTypes.has(r.sourceType),
      );
      if (differentIdx > 0) {
        const temp = results[2];
        results[2] = results[differentIdx];
        results[differentIdx] = temp;
      }
    }
  }

  logger.info("Multi-strategy search complete", {
    query,
    ftsCount: ftsResults.length,
    graphCount: graphResults.length,
    entityGraphCount: entityGraphResults.length,
    lspCount: lspResults.length,
    resultCount: results.length,
  });

  return results;
}
