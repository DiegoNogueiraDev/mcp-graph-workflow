/**
 * Code Context Indexer — captures code analysis results (symbols, flows)
 * into the knowledge store for RAG retrieval.
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

export interface CodeSymbolInput {
  name: string;
  kind: string;
  file: string;
  exported: boolean;
}

export interface ProcessFlowInput {
  name: string;
  steps: string[];
}

export interface CodeAnalysisInput {
  symbols: CodeSymbolInput[];
  flows: ProcessFlowInput[];
}

export interface IndexResult {
  documentsIndexed: number;
}

/**
 * Index code analysis results into the knowledge store.
 */
export function indexCodeAnalysis(
  store: KnowledgeStore,
  analysis: CodeAnalysisInput,
): IndexResult {
  let documentsIndexed = 0;

  // Index symbols summary
  if (analysis.symbols.length > 0) {
    const symbolLines = analysis.symbols.map(
      (s) => `- ${s.kind} ${s.name} (${s.file})${s.exported ? " [exported]" : ""}`,
    );
    const content = `# Code Symbols\n\n${symbolLines.join("\n")}`;

    store.insert({
      sourceType: "code_context",
      sourceId: `code_symbols:${new Date().toISOString()}`,
      title: `Code Symbols (${analysis.symbols.length} symbols)`,
      content,
      metadata: {
        symbolCount: analysis.symbols.length,
        files: [...new Set(analysis.symbols.map((s) => s.file))],
        phase: "IMPLEMENT",
        indexedAt: new Date().toISOString(),
      },
    });
    documentsIndexed++;
  }

  // Index process flows
  for (const flow of analysis.flows) {
    const content = `# Process Flow: ${flow.name}\n\n${flow.steps.map((s) => `→ ${s}`).join("\n")}`;

    store.insert({
      sourceType: "code_context",
      sourceId: `code_flow:${flow.name}`,
      title: `Flow: ${flow.name}`,
      content,
      metadata: {
        flowName: flow.name,
        stepCount: flow.steps.length,
        phase: "IMPLEMENT",
        indexedAt: new Date().toISOString(),
      },
    });
    documentsIndexed++;
  }

  logger.info("Code analysis indexed", {
    symbols: analysis.symbols.length,
    flows: analysis.flows.length,
    documentsIndexed,
  });

  return { documentsIndexed };
}
