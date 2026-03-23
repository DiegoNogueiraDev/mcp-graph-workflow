/**
 * MCP Tool — knowledge_stats
 * Returns statistics about the knowledge store: counts per source type,
 * quality distribution, top accessed docs, staleness info.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerKnowledgeStats(server: McpServer, store: SqliteStore): void {
  server.tool(
    "knowledge_stats",
    "Get statistics about the knowledge store: document counts by source type, quality distribution, top accessed docs, and staleness info.",
    {
      topK: z.number().int().min(1).max(50).optional().describe("Number of top accessed docs to return (default: 5)"),
    },
    async ({ topK }) => {
      logger.debug("tool:knowledge_stats", {});
      const db = store.getDb();
      const knowledgeStore = new KnowledgeStore(db);
      const k = topK ?? 5;

      // Count by source type
      const sourceCounts = db
        .prepare(
          "SELECT source_type, COUNT(*) as count FROM knowledge_documents GROUP BY source_type ORDER BY count DESC",
        )
        .all() as Array<{ source_type: string; count: number }>;

      // Quality distribution
      const qualityDist = db
        .prepare(
          `SELECT
            CASE
              WHEN quality_score >= 0.8 THEN 'high'
              WHEN quality_score >= 0.5 THEN 'medium'
              ELSE 'low'
            END as tier,
            COUNT(*) as count,
            ROUND(AVG(quality_score), 3) as avg_score
          FROM knowledge_documents
          GROUP BY tier`,
        )
        .all() as Array<{ tier: string; count: number; avg_score: number }>;

      // Top accessed docs
      const topAccessed = db
        .prepare(
          `SELECT id, title, source_type, usage_count, quality_score, last_accessed_at
           FROM knowledge_documents
           WHERE usage_count > 0
           ORDER BY usage_count DESC
           LIMIT ?`,
        )
        .all(k) as Array<{
          id: string;
          title: string;
          source_type: string;
          usage_count: number;
          quality_score: number;
          last_accessed_at: string | null;
        }>;

      // Staleness overview
      const stalenessInfo = db
        .prepare(
          `SELECT
            COUNT(CASE WHEN staleness_days = 0 THEN 1 END) as fresh,
            COUNT(CASE WHEN staleness_days BETWEEN 1 AND 30 THEN 1 END) as recent,
            COUNT(CASE WHEN staleness_days BETWEEN 31 AND 90 THEN 1 END) as aging,
            COUNT(CASE WHEN staleness_days > 90 THEN 1 END) as stale
          FROM knowledge_documents`,
        )
        .get() as { fresh: number; recent: number; aging: number; stale: number };

      // Relations count
      const relationsCount = db
        .prepare("SELECT COUNT(*) as count FROM knowledge_relations")
        .get() as { count: number } | undefined;

      const totalDocs = knowledgeStore.count();

      const stats = {
        totalDocuments: totalDocs,
        sourceCounts: sourceCounts.map((r) => ({
          sourceType: r.source_type,
          count: r.count,
        })),
        qualityDistribution: qualityDist.map((r) => ({
          tier: r.tier,
          count: r.count,
          avgScore: r.avg_score,
        })),
        topAccessed: topAccessed.map((r) => ({
          id: r.id,
          title: r.title,
          sourceType: r.source_type,
          usageCount: r.usage_count,
          qualityScore: r.quality_score,
          lastAccessedAt: r.last_accessed_at,
        })),
        staleness: stalenessInfo,
        relationsCount: relationsCount?.count ?? 0,
      };

      logger.info("tool:knowledge_stats:ok", { totalDocs });
      return mcpText(stats);
    },
  );
}
