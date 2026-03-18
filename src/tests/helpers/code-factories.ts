/**
 * Test factories for Code Intelligence engine objects.
 */

import type { CodeSymbol, CodeRelation, AnalyzedFile } from "../../core/code/code-types.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";

export function makeCodeSymbol(overrides: Partial<CodeSymbol> = {}): CodeSymbol {
  const timestamp = now();
  return {
    id: generateId("csym"),
    projectId: "test-project",
    name: "testFunction",
    kind: "function",
    file: "src/test.ts",
    startLine: 1,
    endLine: 10,
    exported: true,
    indexedAt: timestamp,
    ...overrides,
  };
}

export function makeCodeRelation(overrides: Partial<CodeRelation> = {}): CodeRelation {
  const timestamp = now();
  return {
    id: generateId("crel"),
    projectId: "test-project",
    fromSymbol: "csym_source",
    toSymbol: "csym_target",
    type: "calls",
    indexedAt: timestamp,
    ...overrides,
  };
}

export function makeAnalyzedFile(overrides: Partial<AnalyzedFile> = {}): AnalyzedFile {
  return {
    file: "src/test.ts",
    symbols: [
      {
        name: "testFunction",
        kind: "function",
        file: "src/test.ts",
        startLine: 1,
        endLine: 10,
        exported: true,
      },
    ],
    relations: [],
    ...overrides,
  };
}
