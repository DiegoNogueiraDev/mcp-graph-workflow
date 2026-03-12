import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { detectCurrentPhase, getPhaseGuidance } from "../../core/planner/lifecycle-phase.js";
import { logger } from "../../core/utils/logger.js";

const VALID_PHASES = ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "LISTENING", "auto"] as const;

export function registerSetPhase(server: McpServer, store: SqliteStore): void {
  server.tool(
    "set_phase",
    "Override lifecycle phase detection or reset to auto-detection",
    {
      phase: z.enum(VALID_PHASES).describe(
        "Lifecycle phase to force, or 'auto' to reset to automatic detection",
      ),
    },
    async ({ phase }) => {
      logger.debug("tool:set_phase", { phase });

      if (phase === "auto") {
        store.setProjectSetting("lifecycle_phase_override", "");
        const doc = store.toGraphDocument();
        const detectedPhase = detectCurrentPhase(doc);
        const guidance = getPhaseGuidance(detectedPhase);

        logger.info("tool:set_phase:ok", { action: "auto", detectedPhase });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                ok: true,
                action: "reset_to_auto",
                detectedPhase,
                reminder: guidance.reminder,
              }, null, 2),
            },
          ],
        };
      }

      store.setProjectSetting("lifecycle_phase_override", phase);
      const guidance = getPhaseGuidance(phase);

      logger.info("tool:set_phase:ok", { action: "override", phase });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ok: true,
              action: "override",
              phase,
              reminder: guidance.reminder,
            }, null, 2),
          },
        ],
      };
    },
  );
}
