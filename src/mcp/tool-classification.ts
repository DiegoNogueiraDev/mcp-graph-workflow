/**
 * Shared tool classification constants for MCP wrappers.
 * Both lifecycle-wrapper and code-intelligence-wrapper import from here
 * to ensure consistent gating behavior.
 *
 * Resolves bugs #007, #013, #015, #022 — inconsistent whitelists between wrappers.
 */

import { BOOTSTRAP_TOOLS } from "../core/utils/constants.js";

/**
 * Tools that must ALWAYS be allowed regardless of mode (strict/advisory/off).
 * These are bootstrap and configuration tools that should never be blocked.
 * Resolves bugs #001, #002, #005, #006.
 * Re-exported from BOOTSTRAP_TOOLS (single source of truth in constants.ts).
 */
export const ALWAYS_ALLOWED_TOOLS = BOOTSTRAP_TOOLS;

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
  "knowledge_stats",
  "knowledge_feedback",
  "code_intelligence",
  "journey",
]);
