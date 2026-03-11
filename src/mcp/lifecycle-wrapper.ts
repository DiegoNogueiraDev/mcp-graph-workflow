import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphDocument } from "../core/graph/graph-types.js";
import { detectCurrentPhase, getPhaseGuidance, type LifecyclePhase } from "../core/planner/lifecycle-phase.js";
import { logger } from "../core/utils/logger.js";

export interface LifecycleBlock {
  phase: LifecyclePhase;
  reminder: string;
  suggestedNext: string[];
  principles: string[];
}

/**
 * Build the _lifecycle block to append to MCP tool responses.
 */
export function buildLifecycleBlock(doc: GraphDocument): LifecycleBlock {
  const phase = detectCurrentPhase(doc);
  const guidance = getPhaseGuidance(phase);

  return {
    phase,
    reminder: guidance.reminder,
    suggestedNext: guidance.suggestedTools,
    principles: guidance.principles,
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
  [key: string]: unknown;
}

/**
 * Wrap all registered MCP tool handlers to append _lifecycle context to responses.
 * Iterates over already-registered tools and replaces each handler with a wrapper
 * that appends lifecycle info after the original handler returns.
 */
export function wrapToolsWithLifecycle(server: McpServer, store: SqliteStore): void {
  const registeredTools = (server as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;

  if (!registeredTools) {
    logger.warn("lifecycle-wrapper: could not access _registeredTools, skipping lifecycle wrapping");
    return;
  }

  for (const [name, tool] of Object.entries(registeredTools)) {
    const originalHandler = tool.handler;

    tool.handler = async (...args: unknown[]): Promise<unknown> => {
      const result = await originalHandler(...args) as ToolCallResult;

      try {
        const doc = store.toGraphDocument();
        const lifecycleBlock = buildLifecycleBlock(doc);

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
