import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphDocument } from "../core/graph/graph-types.js";
import {
  detectCurrentPhase,
  getPhaseGuidance,
  detectWarnings,
  checkToolGate,
  checkStatusGate,
  type LifecyclePhase,
  type LifecycleWarning,
  type McpAgentSuggestion,
  type StrictnessMode,
} from "../core/planner/lifecycle-phase.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { ToolTokenStore } from "../core/store/tool-token-store.js";
import { estimateTokens } from "../core/context/token-estimator.js";
import { logger } from "../core/utils/logger.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { categorizeError, generateErrorHash } from "../core/skills/self-healing-listener.js";

export interface PhaseKnowledgeSnippet {
  title: string;
  sourceType: string;
  snippet: string;
  phase?: string;
}

export interface LifecycleBlock {
  phase: LifecyclePhase;
  reminder: string;
  suggestedNext: string[];
  principles: string[];
  warnings: LifecycleWarning[];
  suggestedMcpAgents?: McpAgentSuggestion[];
  suggestedSkills?: string[];
  phaseKnowledge?: PhaseKnowledgeSnippet[];
}

export interface LifecycleBlockOptions {
  toolName?: string;
  hasSnapshots?: boolean;
  phaseOverride?: LifecyclePhase | null;
  mode?: StrictnessMode;
  store?: SqliteStore;
}

/**
 * Build the _lifecycle block to append to MCP tool responses.
 * Optionally includes top-3 knowledge snippets relevant to the current phase.
 */
export function buildLifecycleBlock(doc: GraphDocument, options?: LifecycleBlockOptions): LifecycleBlock {
  const phase = detectCurrentPhase(doc, {
    hasSnapshots: options?.hasSnapshots,
    phaseOverride: options?.phaseOverride,
  });
  const guidance = getPhaseGuidance(phase);
  const warnings = options?.toolName
    ? detectWarnings(doc, phase, options.toolName, options?.mode)
    : [];

  // Fetch top-3 phase-relevant knowledge snippets
  let phaseKnowledge: PhaseKnowledgeSnippet[] | undefined;
  if (options?.store) {
    try {
      const knowledgeStore = new KnowledgeStore(options.store.getDb());
      const phaseQuery = `phase ${phase} context`;
      const results = knowledgeStore.searchWithPhaseBoost(phaseQuery, phase, 3);
      if (results.length > 0) {
        phaseKnowledge = results.map((r) => ({
          title: r.title,
          sourceType: r.sourceType,
          snippet: r.content.length > 200 ? r.content.slice(0, 200) + "..." : r.content,
          phase: (r.metadata?.phase as string) ?? undefined,
        }));
      }
    } catch {
      // Knowledge search may fail — not critical
      logger.debug("lifecycle-wrapper: phase knowledge search skipped");
    }
  }

  return {
    phase,
    reminder: guidance.reminder,
    suggestedNext: guidance.suggestedTools,
    principles: guidance.principles,
    warnings,
    ...(guidance.suggestedMcpAgents && guidance.suggestedMcpAgents.length > 0
      ? { suggestedMcpAgents: guidance.suggestedMcpAgents }
      : {}),
    ...(guidance.suggestedSkills && guidance.suggestedSkills.length > 0
      ? { suggestedSkills: guidance.suggestedSkills }
      : {}),
    ...(phaseKnowledge && phaseKnowledge.length > 0 ? { phaseKnowledge } : {}),
  };
}

/**
 * Append _lifecycle block to an existing JSON response string.
 * Returns the augmented JSON string.
 */
export function appendLifecycleToResponse(responseJson: string, doc: GraphDocument): string {
  try {
    const parsed = JSON.parse(responseJson);
    parsed._lifecycle = buildLifecycleBlock(doc);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // If response isn't JSON, append as separate block
    const block = buildLifecycleBlock(doc);
    return responseJson + "\n\n---\n_lifecycle: " + JSON.stringify(block, null, 2);
  }
}

interface RegisteredTool {
  handler: (...args: unknown[]) => Promise<unknown>;
  enabled: boolean;
  [key: string]: unknown;
}

interface ToolCallResult {
  content?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Build a blocked response for when a tool is gated by lifecycle enforcement.
 */
function buildBlockedResponse(
  toolName: string,
  phase: LifecyclePhase,
  warnings: LifecycleWarning[],
): ToolCallResult {
  const errorWarnings = warnings.filter((w) => w.severity === "error");
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        error: "lifecycle_gate_blocked",
        phase,
        tool: toolName,
        reason: errorWarnings.map((w) => w.message).join("; "),
        warnings: errorWarnings,
        hint: "Use set_phase com force:true para bypass, ou mude para mode:'advisory' com set_phase({phase:'auto', mode:'advisory'})",
      }, null, 2),
    }],
    isError: true,
  };
}

/**
 * Extract node ID and new status from tool call args for status gate checks.
 */
function extractStatusArgs(toolName: string, args: unknown[]): { nodeId?: string; newStatus?: string } {
  if (toolName !== "update_status") {
    return {};
  }

  // MCP tool args are passed as the first argument (an object)
  const toolArgs = args[0] as Record<string, unknown> | undefined;
  if (!toolArgs) return {};

  if (toolName === "update_status") {
    return {
      nodeId: toolArgs.nodeId as string | undefined,
      newStatus: toolArgs.status as string | undefined,
    };
  }

  return {};
}

/**
 * Wrap all registered MCP tool handlers to enforce lifecycle gates and append lifecycle context.
 * Pre-execution: checks tool gates and status gates (blocks in strict mode).
 * Post-execution: appends _lifecycle block to responses.
 */
export function wrapToolsWithLifecycle(server: McpServer, store: SqliteStore, eventBus?: GraphEventBus): void {
  const registeredTools = (server as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;

  if (!registeredTools) {
    logger.warn("lifecycle-wrapper: could not access _registeredTools, skipping lifecycle wrapping");
    return;
  }

  for (const [name, tool] of Object.entries(registeredTools)) {
    const originalHandler = tool.handler;

    tool.handler = async (...args: unknown[]): Promise<unknown> => {
      // ── Pre-execution gate check ──
      try {
        const doc = store.toGraphDocument();
        const phaseOverrideValue = store.getProjectSetting("lifecycle_phase_override");
        const snapshots = store.listSnapshots();
        const modeValue = store.getProjectSetting("lifecycle_strictness_mode");
        const mode: StrictnessMode = (modeValue === "strict" || modeValue === "advisory") ? modeValue : "strict";

        const phase = detectCurrentPhase(doc, {
          hasSnapshots: snapshots.length > 0,
          phaseOverride: phaseOverrideValue ? phaseOverrideValue as LifecyclePhase : null,
        });

        // Check tool gate
        const gateWarnings = checkToolGate(doc, phase, name, mode);

        // Check status-specific gate for update_status
        const statusArgs = extractStatusArgs(name, args);
        if (statusArgs.nodeId && statusArgs.newStatus) {
          const statusResult = checkStatusGate(doc, phase, statusArgs.nodeId, statusArgs.newStatus, mode);
          gateWarnings.push(...statusResult.warnings);
        }

        // If any warning has severity "error" → block execution
        const hasErrors = gateWarnings.some((w) => w.severity === "error");
        if (hasErrors) {
          logger.warn("lifecycle-wrapper: tool blocked by gate", { tool: name, phase, mode });
          return buildBlockedResponse(name, phase, gateWarnings);
        }
      } catch {
        // If store has no project loaded (e.g., for `init`), skip gate check
        logger.debug("lifecycle-wrapper: skipped gate check for tool", { tool: name });
      }

      // ── Execute original handler ──
      const result = await originalHandler(...args) as ToolCallResult;

      // ── Token tracking — fire-and-forget, never blocks execution ──
      try {
        const project = store.getProject();
        if (project) {
          const inputText = JSON.stringify(args);
          const outputText = result?.content
            ?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
          const inputTok = estimateTokens(inputText);
          const outputTok = estimateTokens(outputText);
          const toolTokenStore = new ToolTokenStore(store.getDb());
          toolTokenStore.record(project.id, name, inputTok, outputTok);
        }
      } catch {
        logger.debug("lifecycle-wrapper: token tracking skipped", { tool: name });
      }

      // ── Error detection for self-healing ──
      if (eventBus && result?.isError) {
        try {
          const errorText = result.content
            ?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
          const errorCategory = categorizeError(errorText);
          const errorHash = generateErrorHash(errorCategory, errorText);
          eventBus.emitTyped("error:detected", {
            toolName: name,
            errorMessage: errorText.slice(0, 500),
            errorCategory,
            errorHash,
          });
        } catch {
          logger.debug("lifecycle-wrapper: error detection skipped", { tool: name });
        }
      }

      // ── Post-execution: append _lifecycle block ──
      try {
        const doc = store.toGraphDocument();
        const phaseOverrideValue = store.getProjectSetting("lifecycle_phase_override");
        const snapshots = store.listSnapshots();
        const modeValue = store.getProjectSetting("lifecycle_strictness_mode");
        const mode: StrictnessMode = (modeValue === "strict" || modeValue === "advisory") ? modeValue : "strict";

        const lifecycleBlock = buildLifecycleBlock(doc, {
          toolName: name,
          hasSnapshots: snapshots.length > 0,
          phaseOverride: phaseOverrideValue ? phaseOverrideValue as LifecyclePhase : null,
          mode,
          store,
        });

        // Append lifecycle as an additional text content item
        if (result && Array.isArray(result.content)) {
          result.content.push({
            type: "text",
            text: JSON.stringify({ _lifecycle: lifecycleBlock }, null, 2),
          });
        }
      } catch {
        // If store has no project loaded, skip lifecycle silently
        logger.debug("lifecycle-wrapper: skipped for tool", { tool: name });
      }

      return result;
    };
  }

  logger.debug("lifecycle-wrapper: wrapped all tools", { count: Object.keys(registeredTools).length });
}
