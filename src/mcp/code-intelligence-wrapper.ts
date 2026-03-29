/**
 * Code Intelligence MCP wrapper.
 * Enriches all MCP tool responses with automatic Code Intelligence data
 * (impact analysis, symbol context, blast radius).
 *
 * Composition: runs AFTER lifecycle-wrapper (outermost layer).
 * In strict mode, blocks mutating tools when code index is empty.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import { CodeStore } from "../core/code/code-store.js";
import { analyzeImpact } from "../core/code/graph-traversal.js";
import type { CodeSymbol } from "../core/code/code-types.js";
import { detectCurrentPhase, type LifecyclePhase } from "../core/planner/lifecycle-phase.js";
import { logger } from "../core/utils/logger.js";
import { execSync } from "child_process";

// ── Types ───────────────────────────────────────────────

export type CodeIntelligenceMode = "strict" | "advisory" | "off";

export interface CodeIntelWarning {
  code: "index_empty" | "index_stale" | "enrichment_failed" | "no_relevant_symbols";
  message: string;
  severity: "error" | "warning" | "info";
}

export interface CodeIntelEnrichment {
  type: "implement" | "review" | "validate" | "generic";
  relevantSymbols: Array<{ name: string; file: string; kind: string }>;
  impactAnalysis?: {
    affectedCount: number;
    riskLevel: "low" | "medium" | "high";
    topAffected: Array<{ name: string; file: string; confidence: number }>;
  };
}

export interface IndexStatus {
  available: boolean;
  stale: boolean;
  lastIndexed: string | null;
  symbolCount: number;
}

export interface CodeIntelligenceBlock {
  mode: CodeIntelligenceMode;
  indexStatus: IndexStatus;
  enrichment?: CodeIntelEnrichment;
  warnings: CodeIntelWarning[];
}

// ── Constants ───────────────────────────────────────────

import { READ_ONLY_TOOLS } from "./tool-classification.js";

const ENRICHED_PHASES = new Set<string>(["IMPLEMENT", "REVIEW", "VALIDATE"]);

const MAX_TOP_AFFECTED = 5;

// ── Git hash cache ──────────────────────────────────────

let cachedGitHash: string | null = null;
let gitHashTimestamp = 0;
const GIT_HASH_TTL_MS = 30_000;

function getCurrentGitHash(basePath?: string): string | null {
  const now = Date.now();
  if (cachedGitHash !== null && now - gitHashTimestamp < GIT_HASH_TTL_MS) {
    return cachedGitHash;
  }
  try {
    cachedGitHash = execSync("git rev-parse HEAD", {
      cwd: basePath ?? process.cwd(),
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
    gitHashTimestamp = now;
    return cachedGitHash;
  } catch (err) {
    logger.debug("codeIntelligence:gitHashFailure", { error: err instanceof Error ? err.message : String(err) });
    cachedGitHash = null;
    gitHashTimestamp = now;
    return null;
  }
}

// ── Core functions ──────────────────────────────────────

/**
 * Detect whether the code index is stale by comparing stored gitHash with current HEAD.
 * Accepts optional currentGitHash override (for testing without git).
 */
export function detectStaleIndex(
  codeStore: CodeStore,
  projectId: string,
  currentGitHash?: string | null,
): IndexStatus {
  const meta = codeStore.getIndexMeta(projectId);
  if (!meta) {
    return { available: false, stale: false, lastIndexed: null, symbolCount: 0 };
  }

  const gitHash = currentGitHash !== undefined ? currentGitHash : getCurrentGitHash();

  // If either hash is null, we can't determine staleness
  const stale = !!meta.gitHash && !!gitHash && meta.gitHash !== gitHash;

  return {
    available: true,
    stale,
    lastIndexed: meta.lastIndexed,
    symbolCount: meta.symbolCount,
  };
}

/**
 * Extract potential symbol names and file paths from MCP tool arguments.
 * Heuristic: looks for nodeId, title words (>3 chars), backtick-quoted identifiers, file paths.
 */
export function extractRelevantHints(toolName: string, args: unknown[]): string[] {
  const toolArgs = args[0] as Record<string, unknown> | undefined;
  if (!toolArgs) return [];

  const hints: string[] = [];

  // nodeId
  if (typeof toolArgs.nodeId === "string") {
    hints.push(toolArgs.nodeId);
  }

  // title — extract space-separated words > 3 chars
  if (typeof toolArgs.title === "string") {
    const words = toolArgs.title.split(/\s+/).filter(w => /^[a-zA-Z_]\w*$/.test(w) && w.length > 3);
    hints.push(...words);
  }

  // file path
  if (typeof toolArgs.file === "string") {
    hints.push(toolArgs.file);
  }

  // backtick-quoted identifiers from description
  if (typeof toolArgs.description === "string") {
    const backtickMatches = toolArgs.description.match(/`([^`]+)`/g);
    if (backtickMatches) {
      hints.push(...backtickMatches.map(m => m.replace(/`/g, "")));
    }
  }

  return [...new Set(hints)];
}

/**
 * Build the _code_intelligence block for a tool response.
 * Phase-aware: IMPLEMENT/REVIEW/VALIDATE get impact analysis; others get generic summary.
 */
export function buildCodeIntelBlock(
  codeStore: CodeStore,
  projectId: string,
  phase: string,
  mode: CodeIntelligenceMode,
  toolName: string,
  args: unknown[],
  currentGitHash?: string | null,
): CodeIntelligenceBlock {
  // Off mode — return empty block
  if (mode === "off") {
    return {
      mode: "off",
      indexStatus: { available: false, stale: false, lastIndexed: null, symbolCount: 0 },
      warnings: [],
    };
  }

  const indexStatus = detectStaleIndex(codeStore, projectId, currentGitHash);
  const warnings: CodeIntelWarning[] = [];
  const isReadOnly = READ_ONLY_TOOLS.has(toolName);

  // Empty index check
  if (!indexStatus.available) {
    const severity = mode === "strict" && !isReadOnly ? "error" : "warning";
    warnings.push({
      code: "index_empty",
      message: "Code Intelligence index is empty. Run reindex_knowledge or code_intelligence to build it.",
      severity,
    });
    return { mode, indexStatus, warnings };
  }

  // Stale index check
  if (indexStatus.stale) {
    warnings.push({
      code: "index_stale",
      message: "Code Intelligence index is stale (git hash mismatch). Consider running reindex_knowledge.",
      severity: "warning",
    });
  }

  // Build enrichment based on phase
  const enrichment = buildPhaseEnrichment(codeStore, projectId, phase, toolName, args, warnings);

  return { mode, indexStatus, enrichment, warnings };
}

/**
 * Build phase-specific enrichment data.
 */
function buildPhaseEnrichment(
  codeStore: CodeStore,
  projectId: string,
  phase: string,
  toolName: string,
  args: unknown[],
  warnings: CodeIntelWarning[],
): CodeIntelEnrichment | undefined {
  // For non-enriched phases, return generic summary
  if (!ENRICHED_PHASES.has(phase)) {
    return {
      type: "generic",
      relevantSymbols: [],
      impactAnalysis: undefined,
    };
  }

  // Extract hints and find matching symbols
  const hints = extractRelevantHints(toolName, args);
  const relevantSymbols: CodeSymbol[] = [];

  for (const hint of hints) {
    const found = codeStore.findSymbolsByName(hint, projectId);
    relevantSymbols.push(...found);
  }

  if (relevantSymbols.length === 0 && hints.length > 0) {
    warnings.push({
      code: "no_relevant_symbols",
      message: `No symbols found matching hints: ${hints.join(", ")}`,
      severity: "info",
    });
  }

  const symbolSummary = relevantSymbols.map(s => ({
    name: s.name,
    file: s.file,
    kind: s.kind,
  }));

  // Phase-specific enrichment type
  const type = phaseToEnrichmentType(phase);

  // Impact analysis for enriched phases
  let impactAnalysis: CodeIntelEnrichment["impactAnalysis"];
  if (relevantSymbols.length > 0) {
    const primarySymbol = relevantSymbols[0];
    const direction = type === "validate" ? "downstream" : "upstream";
    const maxDepth = type === "review" ? 3 : 2;

    const impact = analyzeImpact(codeStore, primarySymbol.name, projectId, direction, maxDepth);

    impactAnalysis = {
      affectedCount: impact.affectedSymbols.length,
      riskLevel: impact.riskLevel,
      topAffected: impact.affectedSymbols
        .slice(0, MAX_TOP_AFFECTED)
        .map(a => ({ name: a.name, file: a.file, confidence: a.confidence })),
    };
  }

  return { type, relevantSymbols: symbolSummary, impactAnalysis };
}

function phaseToEnrichmentType(phase: string): "implement" | "review" | "validate" | "generic" {
  switch (phase) {
    case "IMPLEMENT": return "implement";
    case "REVIEW": return "review";
    case "VALIDATE": return "validate";
    default: return "generic";
  }
}

// ── Blocked response ────────────────────────────────────

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Build a blocked response when strict mode prevents tool execution.
 */
export function buildBlockedResponseCodeIntel(
  toolName: string,
  warnings: CodeIntelWarning[],
): ToolCallResult {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: "code_intelligence_gate_blocked",
        tool: toolName,
        warnings,
        hint: "Run reindex_knowledge to build the code index, or use set_phase({codeIntelligence:'advisory'}) to switch to advisory mode.",
      }, null, 2),
    }],
    isError: true,
  };
}

// ── Wrapper ─────────────────────────────────────────────

interface RegisteredTool {
  handler: (...args: unknown[]) => Promise<unknown>;
  enabled: boolean;
  [key: string]: unknown;
}

/**
 * Wrap all registered MCP tool handlers to enrich responses with Code Intelligence data.
 * Must be called AFTER wrapToolsWithLifecycle (outermost wrapper).
 */
export function wrapToolsWithCodeIntelligence(server: McpServer, store: SqliteStore): void {
  const registeredTools = (server as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;

  if (!registeredTools) {
    logger.warn("code-intelligence-wrapper: could not access _registeredTools, skipping wrapping");
    return;
  }

  // Bug #014/#019: cache mode to ensure consistency across parallel tool calls.
  // Invalidated only when set_phase is called (which changes the mode).
  let cachedMode: CodeIntelligenceMode | null = null;

  function loadMode(): CodeIntelligenceMode {
    try {
      const modeValue = store.getProjectSetting("code_intelligence_mode");
      if (modeValue === "strict" || modeValue === "advisory" || modeValue === "off") {
        return modeValue;
      }
    } catch (err) {
      logger.debug("codeIntelligence:loadModeFailure", { error: err instanceof Error ? err.message : String(err) });
      // No project loaded
    }
    return "off";
  }

  for (const [name, tool] of Object.entries(registeredTools)) {
    const originalHandler = tool.handler;

    tool.handler = async (...args: unknown[]): Promise<unknown> => {
      // ── Load mode (cached for consistency across parallel calls) ──
      // Invalidate cache when set_phase changes the mode
      if (cachedMode === null || name === "set_phase") {
        cachedMode = loadMode();
      }
      const mode = cachedMode;

      if (mode === "off") {
        const offResult = await originalHandler(...args);
        // Bug #001/#002: invalidate cache even in "off" mode — set_phase may change it
        if (name === "set_phase") {
          cachedMode = null;
        }
        return offResult;
      }

      // ── Pre-execution gate check (strict mode) ──
      // Bug #001/NEW-2: auto-downgrade strict→advisory when index is empty.
      // This prevents deadlock in projects without source code where the code
      // symbol index will never have content.
      let effectiveMode = mode;
      try {
        const project = store.getProject();
        if (project) {
          const codeStore = new CodeStore(store.getDb());
          const indexStatus = detectStaleIndex(codeStore, project.id);

          if (mode === "strict" && !indexStatus.available && !READ_ONLY_TOOLS.has(name)) {
            logger.warn("code-intelligence-wrapper: strict mode auto-downgraded to advisory — empty index", { tool: name });
            effectiveMode = "advisory";
          }
        }
      } catch {
        logger.debug("code-intelligence-wrapper: skipped pre-check for tool", { tool: name });
      }

      // ── Execute original handler ──
      const result = await originalHandler(...args) as ToolCallResult | undefined;

      // ── Post-execution: append _code_intelligence block ──
      try {
        const project = store.getProject();
        if (project) {
          const codeStore = new CodeStore(store.getDb());
          const phaseOverrideValue = store.getProjectSetting("lifecycle_phase_override");
          const doc = store.toGraphDocument();
          const phase = detectCurrentPhase(doc, {
            phaseOverride: phaseOverrideValue ? phaseOverrideValue as LifecyclePhase : null,
          });

          // Bug #002: for set_phase, re-read the mode from DB after handler has updated it
          const enrichmentMode = name === "set_phase" ? loadMode() : effectiveMode;
          const block = buildCodeIntelBlock(codeStore, project.id, phase, enrichmentMode, name, args);

          if (result && Array.isArray(result.content)) {
            result.content.push({
              type: "text",
              text: JSON.stringify({ _code_intelligence: block }, null, 2),
            });
          }
        }
      } catch {
        logger.debug("code-intelligence-wrapper: skipped enrichment for tool", { tool: name });
      }

      // Bug #001/#002: invalidate cache AFTER set_phase handler has written new value to DB.
      // The cache was loaded BEFORE the handler ran, so it holds the old value.
      // Nullifying forces a fresh read from DB on the next tool call.
      if (name === "set_phase") {
        cachedMode = null;
      }

      return result;
    };
  }

  logger.debug("code-intelligence-wrapper: wrapped all tools", { count: Object.keys(registeredTools).length });
}
