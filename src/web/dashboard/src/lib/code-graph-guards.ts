/**
 * Runtime type guards for code graph query results.
 * Used to detect whether API responses are CodeGraphData or ImpactResult
 * and render them with appropriate UI (table vs card vs raw JSON).
 * No React/DOM dependencies — fully testable.
 */

import type { CodeGraphData, ImpactResult } from "./types.js";

export function isCodeGraphData(d: unknown): d is CodeGraphData {
  return (
    d != null &&
    typeof d === "object" &&
    "symbols" in d &&
    Array.isArray((d as CodeGraphData).symbols)
  );
}

export function isImpactResult(d: unknown): d is ImpactResult {
  return (
    d != null &&
    typeof d === "object" &&
    "riskLevel" in d &&
    "affectedSymbols" in d
  );
}

/**
 * Check if data is a Cypher result wrapper ({ result: [...] }).
 */
export function isCypherResult(d: unknown): d is { result: Array<Record<string, unknown>> } {
  return (
    d != null &&
    typeof d === "object" &&
    "result" in d &&
    Array.isArray((d as { result: unknown }).result) &&
    (d as { result: unknown[] }).result.length > 0 &&
    typeof (d as { result: unknown[] }).result[0] === "object"
  );
}

/**
 * Check if data is a plain array of objects (tabular data).
 */
export function isTabularData(d: unknown): d is Array<Record<string, unknown>> {
  if (!Array.isArray(d) || d.length === 0) return false;
  // Verify first element is a plain object with string keys
  const first = d[0];
  return first != null && typeof first === "object" && !Array.isArray(first);
}
