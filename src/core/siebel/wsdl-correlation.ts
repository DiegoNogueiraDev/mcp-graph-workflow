/**
 * WSDL Correlation — matches WSDL services/operations with Integration Objects from the SIF repository.
 */

import type { WsdlParseResult } from "./wsdl-parser.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

export interface WsdlCorrelationMatch {
  serviceName: string;
  operationName: string;
  ioName: string;
  confidence: number;
}

export interface WsdlCorrelationResult {
  matches: WsdlCorrelationMatch[];
  unmatchedOperations: string[];
  unmatchedIOs: string[];
  coverageScore: number;
}

/**
 * Correlate WSDL operations with Integration Objects by name similarity.
 */
export function correlateWsdlWithObjects(
  wsdlResult: WsdlParseResult,
  objects: SiebelObject[],
): WsdlCorrelationResult {
  const ios = objects.filter((o) => o.type === "integration_object");
  const serviceName = wsdlResult.services[0]?.name ?? "";

  if (wsdlResult.operations.length === 0) {
    return { matches: [], unmatchedOperations: [], unmatchedIOs: ios.map((io) => io.name), coverageScore: 100 };
  }

  const matches: WsdlCorrelationMatch[] = [];
  const matchedOperations = new Set<string>();
  const matchedIOs = new Set<string>();

  // Try to match each operation to an IO
  for (const op of wsdlResult.operations) {
    const opTokens = tokenize(op.name);
    const serviceTokens = tokenize(serviceName);
    const allTokens = new Set([...opTokens, ...serviceTokens]);

    let bestMatch: { io: SiebelObject; score: number } | null = null;

    for (const io of ios) {
      const ioTokens = tokenize(io.name);
      const score = jaccardSimilarity(allTokens, new Set(ioTokens));
      if (score > 0.1 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { io, score };
      }
    }

    if (bestMatch) {
      matches.push({
        serviceName,
        operationName: op.name,
        ioName: bestMatch.io.name,
        confidence: Math.round(bestMatch.score * 100),
      });
      matchedOperations.add(op.name);
      matchedIOs.add(bestMatch.io.name);
    }
  }

  const unmatchedOperations = wsdlResult.operations
    .filter((op) => !matchedOperations.has(op.name))
    .map((op) => op.name);

  const unmatchedIOs = ios
    .filter((io) => !matchedIOs.has(io.name))
    .map((io) => io.name);

  const totalItems = wsdlResult.operations.length + ios.length;
  const matchedItems = matchedOperations.size + matchedIOs.size;
  const coverageScore = totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 100;

  return { matches, unmatchedOperations, unmatchedIOs, coverageScore };
}

function tokenize(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 0;
}
