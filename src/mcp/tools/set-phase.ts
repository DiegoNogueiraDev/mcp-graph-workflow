import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { detectCurrentPhase, getPhaseGuidance, validatePhaseTransition, type LifecyclePhase, type StrictnessMode } from "../../core/planner/lifecycle-phase.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { generateAndIndexPhaseSummary } from "../../core/rag/phase-summary.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const VALID_PHASES = ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "LISTENING", "auto"] as const;

export function registerSetPhase(server: McpServer, store: SqliteStore): void {
  server.tool(
    "set_phase",
    "Override lifecycle phase detection or reset to auto-detection. Use mode to switch between strict/advisory enforcement.",
    {
      phase: z.enum(VALID_PHASES).describe(
        "Lifecycle phase to force, or 'auto' to reset to automatic detection",
      ),
      force: z.boolean().optional().describe(
        "Force phase transition even if gate conditions are not met (strict mode only)",
      ),
      mode: z.enum(["strict", "advisory"]).optional().describe(
        "Set lifecycle enforcement mode: 'strict' blocks tools, 'advisory' only warns",
      ),
      codeIntelligence: z.enum(["strict", "advisory", "off"]).optional().describe(
        "Code Intelligence enforcement: 'strict' blocks mutating tools if index empty, 'advisory' warns, 'off' disables",
      ),
      prerequisites: z.enum(["strict", "advisory", "off"]).optional().describe(
        "Tool prerequisites enforcement: 'strict' blocks tools if mandatory prerequisites not called, 'advisory' warns, 'off' disables",
      ),
    },
    async ({ phase, force, mode, codeIntelligence, prerequisites }) => {
      logger.debug("tool:set_phase", { phase, force, mode, codeIntelligence, prerequisites });

      // Persist strictness mode if provided
      if (mode) {
        store.setProjectSetting("lifecycle_strictness_mode", mode);
        logger.info("tool:set_phase:mode_changed", { mode });
      }

      // Persist Code Intelligence mode if provided
      if (codeIntelligence) {
        store.setProjectSetting("code_intelligence_mode", codeIntelligence);
        logger.info("tool:set_phase:code_intelligence_changed", { codeIntelligence });
      }

      // Persist Tool Prerequisites mode if provided
      if (prerequisites) {
        store.setProjectSetting("tool_prerequisites_mode", prerequisites);
        logger.info("tool:set_phase:prerequisites_changed", { prerequisites });
      }

      if (phase === "auto") {
        store.setProjectSetting("lifecycle_phase_override", "");
        const doc = store.toGraphDocument();
        const detectedPhase = detectCurrentPhase(doc);
        const guidance = getPhaseGuidance(detectedPhase);
        const currentMode = mode ?? (store.getProjectSetting("lifecycle_strictness_mode") as StrictnessMode | null) ?? "strict";

        const currentCodeIntel = codeIntelligence ?? store.getProjectSetting("code_intelligence_mode") ?? "off";
        const currentPrereqs = prerequisites ?? store.getProjectSetting("tool_prerequisites_mode") ?? "advisory";
        logger.info("tool:set_phase:ok", { action: "auto", detectedPhase, mode: currentMode, codeIntelligence: currentCodeIntel, prerequisites: currentPrereqs });
        return mcpText({
          ok: true,
          action: "reset_to_auto",
          detectedPhase,
          mode: currentMode,
          codeIntelligence: currentCodeIntel,
          prerequisites: currentPrereqs,
          reminder: guidance.reminder,
        });
      }

      // Validate phase transition gate
      const doc = store.toGraphDocument();
      const currentPhaseOverride = store.getProjectSetting("lifecycle_phase_override");
      const currentPhase = currentPhaseOverride
        ? currentPhaseOverride as typeof VALID_PHASES[number]
        : detectCurrentPhase(doc);
      const currentMode: StrictnessMode = mode ?? (store.getProjectSetting("lifecycle_strictness_mode") as StrictnessMode | null) ?? "strict";

      if (currentPhase !== phase) {
        const gateResult = validatePhaseTransition(doc, currentPhase as Exclude<typeof phase, "auto">, phase);

        if (!gateResult.allowed && currentMode === "strict" && !force) {
          logger.warn("tool:set_phase:gate_blocked", { from: currentPhase, to: phase, unmetConditions: gateResult.unmetConditions });
          return mcpError(`phase_gate_blocked: from ${currentPhase} to ${phase}. ${gateResult.reason}. Unmet: ${JSON.stringify(gateResult.unmetConditions)}. Hint: Use force:true para bypass, ou complete as condições listadas`);
        }

        if (!gateResult.allowed && force) {
          logger.warn("tool:set_phase:forced", { from: currentPhase, to: phase, unmetConditions: gateResult.unmetConditions });
        }
      }

      // Generate phase summary when transitioning between different phases
      let phaseSummaryIndexed = false;
      if (currentPhase !== phase) {
        try {
          const knowledgeStore = new KnowledgeStore(store.getDb());
          const summaryResult = generateAndIndexPhaseSummary(
            knowledgeStore,
            doc,
            currentPhase as LifecyclePhase,
            phase,
          );
          phaseSummaryIndexed = summaryResult.indexed;
        } catch (err) {
          logger.warn("tool:set_phase:summary_failed", { error: String(err) });
        }
      }

      store.setProjectSetting("lifecycle_phase_override", phase);
      const guidance = getPhaseGuidance(phase);

      const currentCodeIntel = codeIntelligence ?? store.getProjectSetting("code_intelligence_mode") ?? "off";
      const currentPrereqs = prerequisites ?? store.getProjectSetting("tool_prerequisites_mode") ?? "advisory";
      logger.info("tool:set_phase:ok", { action: "override", phase, mode: currentMode, codeIntelligence: currentCodeIntel, prerequisites: currentPrereqs, phaseSummaryIndexed });
      return mcpText({
        ok: true,
        action: "override",
        phase,
        mode: currentMode,
        codeIntelligence: currentCodeIntel,
        prerequisites: currentPrereqs,
        reminder: guidance.reminder,
        phaseSummaryIndexed,
      });
    },
  );
}
