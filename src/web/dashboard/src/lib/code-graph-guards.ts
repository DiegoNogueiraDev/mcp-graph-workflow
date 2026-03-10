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
