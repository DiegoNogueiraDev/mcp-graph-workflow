import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { validateAcQuality } from "../../core/analyzer/ac-validator.js";
import { logger } from "../../core/utils/logger.js";

export function registerValidateAc(server: McpServer, store: SqliteStore): void {
  server.tool(
    "validate_ac",
    "Validate acceptance criteria quality using INVEST checks (Independent, Negotiable, Valuable, Estimable, Small, Testable). Detects GWT format (EN/PT), vague terms, and testability.",
    {
      nodeId: z.string().optional().describe("Validate AC for a specific node"),
      all: z.boolean().optional().describe("Validate all nodes with AC (default: true if no nodeId)"),
    },
    async ({ nodeId, all }) => {
      logger.debug("tool:validate_ac", { nodeId, all });
      const doc = store.toGraphDocument();
      const report = validateAcQuality(doc, nodeId, all ?? !nodeId);

      logger.info("tool:validate_ac:ok", { nodes: report.nodes.length, score: report.overallScore });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, ...report }, null, 2),
          },
        ],
      };
    },
  );
}
