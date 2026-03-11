import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  findTransitiveBlockers,
  detectCycles,
  findCriticalPath,
} from "../../core/planner/dependency-chain.js";
import { logger } from "../../core/utils/logger.js";

export function registerDependencies(server: McpServer, store: SqliteStore): void {
  server.tool(
    "dependencies",
    "Analyze dependency chains: find blockers for a node, detect cycles, or compute critical path",
    {
      mode: z.enum(["blockers", "cycles", "critical_path"]).describe("Analysis mode"),
      nodeId: z.string().optional().describe("Node ID (required for 'blockers' mode)"),
    },
    async ({ mode, nodeId }) => {
      logger.debug("tool:dependencies", { nodeId, mode });
      const doc = store.toGraphDocument();

      if (mode === "blockers") {
        if (!nodeId) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "nodeId is required for 'blockers' mode" }) },
            ],
            isError: true,
          };
        }
        const blockers = findTransitiveBlockers(doc, nodeId);
        logger.info("tool:dependencies:ok", { mode: "blockers", nodeId, blockerCount: blockers.length });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ok: true, nodeId, blockers }, null, 2) },
          ],
        };
      }

      if (mode === "cycles") {
        const cycles = detectCycles(doc);
        logger.info("tool:dependencies:ok", { mode: "cycles", cycleCount: cycles.length });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ok: true, cycles }, null, 2) },
          ],
        };
      }

      // critical_path
      const path = findCriticalPath(doc);
      logger.info("tool:dependencies:ok", { mode: "critical_path", pathLength: path.length });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ ok: true, criticalPath: path }, null, 2) },
        ],
      };
    },
  );
}
