/**
 * Shared tool classification constants for MCP wrappers.
 * Both lifecycle-wrapper and code-intelligence-wrapper import from here
 * to ensure consistent gating behavior.
 *
 * Resolves bugs #007, #013, #015, #022 — inconsistent whitelists between wrappers.
 */

/**
 * Tools that must ALWAYS be allowed regardless of mode (strict/advisory/off).
 * These are bootstrap and configuration tools that should never be blocked.
 * Resolves bugs #001, #002, #005, #006.
 */
export const ALWAYS_ALLOWED_TOOLS = new Set([
  "init",
  "set_phase",
  "reindex_knowledge",
  "sync_stack_docs",
]);

/**
 * Tools that perform read-only operations and should never be blocked
 * by code-intelligence or lifecycle gates.
 * Includes ALWAYS_ALLOWED_TOOLS as a subset.
 */
export const READ_ONLY_TOOLS = new Set([
  // Bootstrap / config (always allowed)
  ...ALWAYS_ALLOWED_TOOLS,
  // Pure read operations
  "list",
  "show",
  "search",
  "metrics",
  "export",
  "context",
  "rag_context",
  "analyze",
  "snapshot",
  "next",
  "list_memories",
  "read_memory",
  "list_skills",
  "stats",
  "velocity",
  "dependencies",
  "plan_sprint",
  "validate_ac",
  "manage_skill",
  "knowledge_stats",
  "knowledge_feedback",
  "code_intelligence",
  "journey",
]);
