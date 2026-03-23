/**
 * Validation Indexer — captures AC validation results into knowledge store.
 * Triggered when the validate tool completes with action "ac".
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

export interface AcResult {
  criterion: string;
  passed: boolean;
  reason?: string;
}

export interface ValidationInput {
  nodeId: string;
  acResults: AcResult[];
  overallScore: number;
}

export interface IndexResult {
  documentsIndexed: number;
}

/**
 * Index AC validation results into the knowledge store.
 */
export function indexAcValidationResult(
  store: KnowledgeStore,
  input: ValidationInput,
): IndexResult {
  const passCount = input.acResults.filter((r) => r.passed).length;
  const passRate = input.acResults.length > 0 ? passCount / input.acResults.length : 0;

  const lines = input.acResults.map((r) => {
    const status = r.passed ? "PASS" : "FAIL";
    const reason = r.reason ? ` — ${r.reason}` : "";
    return `- [${status}] ${r.criterion}${reason}`;
  });

  const content = `# Validation Results: ${input.nodeId}\n\nScore: ${input.overallScore}\nPass rate: ${Math.round(passRate * 100)}%\n\n${lines.join("\n")}`;

  store.insert({
    sourceType: "validation_result",
    sourceId: `validation:${input.nodeId}:${new Date().toISOString()}`,
    title: `Validation: ${input.nodeId} (${Math.round(passRate * 100)}%)`,
    content,
    metadata: {
      nodeId: input.nodeId,
      passRate,
      acCount: input.acResults.length,
      overallScore: input.overallScore,
      phase: "VALIDATE",
      indexedAt: new Date().toISOString(),
    },
  });

  logger.info("Validation result indexed", { nodeId: input.nodeId, passRate });

  return { documentsIndexed: 1 };
}
