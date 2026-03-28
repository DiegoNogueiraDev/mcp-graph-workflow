import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { calculateVelocity } from "../../core/planner/velocity.js";
import { detectCurrentPhase } from "../../core/planner/lifecycle-phase.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerMetrics(server: McpServer, store: SqliteStore): void {
  server.tool(
    "metrics",
    "Show project metrics. Mode 'stats' returns aggregate graph statistics; mode 'velocity' returns sprint velocity metrics.",
    {
      mode: z.enum(["stats", "velocity"]).describe("Metrics mode: 'stats' for graph statistics, 'velocity' for sprint velocity"),
      sprint: z.string().optional().describe("Filter velocity results to a specific sprint (only used in velocity mode)"),
    },
    async ({ mode, sprint }) => {
      logger.debug("tool:metrics", { mode, sprint });

      if (mode === "velocity") {
        const doc = store.toGraphDocument();
        const summary = calculateVelocity(doc);

        if (sprint) {
          const filtered = summary.sprints.filter((s) => s.sprint === sprint);
          // Bug #039: warn when sprint filter finds nothing instead of returning global stats
          if (filtered.length === 0) {
            logger.info("tool:metrics:velocity:ok", { sprintCount: 0, sprintFilter: sprint });
            return mcpText({
              ok: true,
              mode: "velocity",
              warning: `No sprint matching '${sprint}' found`,
              sprintFilter: sprint,
              sprints: [],
              overall: summary.overall,
            });
          }
          summary.sprints = filtered;
        }

        logger.info("tool:metrics:velocity:ok", { sprintCount: summary.sprints.length });
        return mcpText({ ok: true, mode: "velocity", ...summary });
      }

      // mode === "stats"
      const stats = store.getStats();
      const project = store.getProject();

      let contextReduction: { avgReductionPercent: number; sampleSize: number } | null = null;

      if (stats.totalNodes > 0) {
        const allNodes = store.getAllNodes();
        const taskNodes = allNodes.filter(
          (n) => n.type === "task" || n.type === "subtask",
        );

        if (taskNodes.length > 0) {
          let totalReduction = 0;
          let sampled = 0;
          // Bug #066: sample max 50 nodes instead of ALL tasks for performance
          const sampleNodes = taskNodes.slice(0, 50);

          for (const node of sampleNodes) {
            const ctx = buildTaskContext(store, node.id);
            if (ctx) {
              totalReduction += ctx.metrics.reductionPercent;
              sampled++;
            }
          }

          if (sampled > 0) {
            contextReduction = {
              avgReductionPercent: Math.round(totalReduction / sampled),
              sampleSize: sampled,
            };
          }
        }
      }

      // Bug #067: add sprint count, phase, knowledge count
      const doc = store.toGraphDocument();
      const currentPhase = detectCurrentPhase(doc);
      const velocity = calculateVelocity(doc);
      let knowledgeDocCount = 0;
      try {
        const ks = new KnowledgeStore(store.getDb());
        knowledgeDocCount = ks.list({}).length;
      } catch { /* knowledge store may not exist */ }

      logger.info("tool:metrics:stats:ok", { totalNodes: stats.totalNodes, totalEdges: stats.totalEdges });
      return mcpText({
        ok: true,
        mode: "stats",
        project: project?.name ?? null,
        ...stats,
        currentPhase,
        sprintCount: velocity.sprints.length,
        knowledgeDocCount,
        contextReduction,
      });
    },
  );
}
