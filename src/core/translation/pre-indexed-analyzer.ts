/**
 * Pre-indexed Analysis — leverages Code Intelligence symbol table
 * to provide instant translation analysis for already-indexed files.
 *
 * Maps code intelligence symbol kinds to UCR constructs:
 * function → uc_fn_def, class → uc_class_def, interface → uc_interface, etc.
 */

import type { CodeStore } from "../code/code-store.js";
import type { TranslationAnalysis } from "./translation-types.js";
import { logger } from "../utils/logger.js";

/** Map Code Intelligence symbol kind → UCR construct ID */
const KIND_TO_CONSTRUCT: Record<string, string> = {
  function: "uc_fn_def",
  method: "uc_fn_def",
  class: "uc_class_def",
  interface: "uc_interface",
  enum: "uc_type_enum",
  variable: "uc_var_const",
  type: "uc_type_alias",
  property: "uc_fn_def",
};

/** File extension → detected language */
const EXT_TO_LANGUAGE: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".lua": "lua",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".c": "c",
  ".dart": "dart",
};

export interface PreIndexedResult {
  analysis: TranslationAnalysis;
  fromIndex: true;
}

/**
 * Try to build a TranslationAnalysis from the Code Intelligence index.
 * Returns null if the file is not indexed or the index is stale.
 */
export function analyzeFromIndex(
  codeStore: CodeStore,
  projectId: string,
  filePath: string,
): PreIndexedResult | null {
  try {
    const meta = codeStore.getIndexMeta(projectId);
    if (!meta) return null;

    // Get symbols for this specific file
    const allSymbols = codeStore.getAllSymbols(projectId, 10000);
    const fileSymbols = allSymbols.filter((s) => s.file === filePath);

    if (fileSymbols.length === 0) return null;

    // Detect language from file extension
    const ext = filePath.includes(".") ? "." + filePath.split(".").pop()!.toLowerCase() : "";
    const detectedLanguage = EXT_TO_LANGUAGE[ext] ?? "unknown";

    // Map symbols to constructs
    const constructCounts = new Map<string, number>();
    for (const sym of fileSymbols) {
      const constructId = KIND_TO_CONSTRUCT[sym.kind];
      if (constructId) {
        constructCounts.set(constructId, (constructCounts.get(constructId) ?? 0) + 1);
      }
    }

    const constructs = Array.from(constructCounts.entries()).map(([canonicalName, count]) => ({
      canonicalName,
      count,
      confidence: 0.9, // slightly lower than direct parsing since we're mapping kinds
    }));

    const totalConstructs = constructs.reduce((sum, c) => sum + c.count, 0);
    const uniqueConstructs = constructs.length;
    const complexityScore = Math.min(uniqueConstructs / 15, 1);

    const analysis: TranslationAnalysis = {
      detectedLanguage,
      detectedConfidence: 1.0, // file extension is definitive
      constructs,
      complexityScore,
      estimatedTranslatability: totalConstructs > 0 ? 0.95 : 0,
      ambiguousConstructs: [],
      totalConstructs,
    };

    logger.debug("pre-indexed-analysis", {
      file: filePath,
      language: detectedLanguage,
      symbols: fileSymbols.length,
      constructs: totalConstructs,
    });

    return { analysis, fromIndex: true };
  } catch (err) {
    logger.debug("pre-indexed-analysis:failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
