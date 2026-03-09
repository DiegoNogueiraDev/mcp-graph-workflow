import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";

export function registerStats(server: McpServer, store: SqliteStore): void {
  server.tool(
    "stats",
    "Show aggregate statistics for the project graph, including context compression metrics",
    {},
    async () => {
      const stats = store.getStats();
      const project = store.getProject();

      // Calculate average context reduction across all task/subtask nodes
      let contextReduction: { avgReductionPercent: number; sampleSize: number } | null = null;

      if (stats.totalNodes > 0) {
        const allNodes = store.getAllNodes();
        const taskNodes = allNodes.filter(
          (n) => n.type === "task" || n.type === "subtask",
        );

        if (taskNodes.length > 0) {
          let totalReduction = 0;
          let sampled = 0;

          for (const node of taskNodes) {
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

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                project: project?.name ?? null,
                ...stats,
                contextReduction,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
