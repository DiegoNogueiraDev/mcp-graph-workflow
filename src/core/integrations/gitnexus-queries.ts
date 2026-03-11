/**
 * GitNexus query builders and response parsers.
 * Converts symbol names into Cypher queries and parses GitNexus responses
 * into structured CodeGraphData and ImpactResult formats.
 */

import { logger } from "../utils/logger.js";

export interface CodeSymbol {
  name: string;
  kind: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, unknown>;
}

export interface CodeRelation {
  from: string;
  to: string;
  type: string;
}

export interface CodeGraphData {
  symbols: CodeSymbol[];
  relations: CodeRelation[];
}

export interface AffectedSymbol {
  name: string;
  file: string;
  confidence: number;
}

export type RiskLevel = "low" | "medium" | "high";

export interface ImpactResult {
  symbol: string;
  affectedSymbols: AffectedSymbol[];
  riskLevel: RiskLevel;
}

/**
 * Build a Cypher query to retrieve a symbol's context (related symbols and relations).
 */
export function buildContextQuery(symbol: string): string {
  // Escape single quotes in symbol name to prevent Cypher injection
  const escaped = symbol.replace(/'/g, "\\'");
  return `MATCH (s {name: '${escaped}'})-[r:CodeRelation]-(related) RETURN s.name AS sName, s.filePath AS sFile, r.type AS relType, related.name AS rName, related.filePath AS rFile, related.startLine AS rStartLine, related.endLine AS rEndLine LIMIT 50`;
}

/**
 * Build a Cypher query for upstream impact analysis (who depends on this symbol).
 */
export function buildImpactQuery(symbol: string): string {
  const escaped = symbol.replace(/'/g, "\\'");
  return `MATCH (dep)-[r:CodeRelation]->(s {name: '${escaped}'}) WHERE r.type = 'CALLS' OR r.type = 'IMPORTS' RETURN DISTINCT dep.name AS name, dep.filePath AS file, 1 AS depth LIMIT 30`;
}

/**
 * Calculate risk level based on number of affected symbols.
 */
export function calculateRiskLevel(affectedCount: number): RiskLevel {
  if (affectedCount > 15) return "high";
  if (affectedCount >= 5) return "medium";
  return "low";
}

/**
 * Parse a GitNexus Cypher response into CodeGraphData.
 * Handles the { result: [...] } format from GitNexus query endpoint.
 */
export function parseContextResponse(raw: unknown): CodeGraphData {
  const empty: CodeGraphData = { symbols: [], relations: [] };

  if (raw == null || typeof raw !== "object") return empty;

  const records = extractRecords(raw);
  if (records.length === 0) return empty;

  const symbolMap = new Map<string, CodeSymbol>();
  const relations: CodeRelation[] = [];

  for (const record of records) {
    // Flattened format: sName, sFile, relType, rName, rFile, rStartLine, rEndLine
    const sName = typeof record.sName === "string" ? record.sName : undefined;
    const rName = typeof record.rName === "string" ? record.rName : undefined;
    const relType = typeof record.relType === "string" ? record.relType : undefined;

    if (sName && !symbolMap.has(sName)) {
      symbolMap.set(sName, {
        name: sName,
        kind: "unknown",
        file: typeof record.sFile === "string" ? record.sFile : undefined,
      });
    }

    if (rName && !symbolMap.has(rName)) {
      symbolMap.set(rName, {
        name: rName,
        kind: "unknown",
        file: typeof record.rFile === "string" ? record.rFile : undefined,
        startLine: typeof record.rStartLine === "number" ? record.rStartLine : undefined,
        endLine: typeof record.rEndLine === "number" ? record.rEndLine : undefined,
      });
    }

    if (sName && rName && relType) {
      relations.push({
        from: sName,
        to: rName,
        type: relType.toLowerCase(),
      });
    }

    // Fallback: nested node format (legacy)
    if (!sName) {
      const s = extractNodeData(record, "s");
      if (s) symbolMap.set(s.name, s);
      const related = extractNodeData(record, "related");
      if (related) symbolMap.set(related.name, related);
      const legacyRelType = typeof record.relType === "string" ? record.relType : undefined;
      if (s && related && legacyRelType) {
        relations.push({ from: s.name, to: related.name, type: legacyRelType.toLowerCase() });
      }
    }
  }

  return {
    symbols: Array.from(symbolMap.values()),
    relations,
  };
}

/**
 * Parse a GitNexus Cypher impact response into ImpactResult.
 */
export function parseImpactResponse(raw: unknown, symbol: string): ImpactResult {
  const empty: ImpactResult = { symbol, affectedSymbols: [], riskLevel: "low" };

  if (raw == null || typeof raw !== "object") return empty;

  const records = extractRecords(raw);
  if (records.length === 0) return empty;

  const affectedSymbols: AffectedSymbol[] = [];

  for (const record of records) {
    const name = typeof record.name === "string" ? record.name : undefined;
    const file = typeof record.file === "string" ? record.file : "";
    const depth = typeof record.depth === "number" ? record.depth : 3;

    if (name) {
      // Confidence decreases with depth: d=1 → 1.0, d=2 → 0.7, d=3 → 0.4
      const confidence = Math.max(0.1, 1.0 - (depth - 1) * 0.3);
      affectedSymbols.push({ name, file, confidence });
    }
  }

  const riskLevel = calculateRiskLevel(affectedSymbols.length);

  logger.debug("Parsed impact response", {
    symbol,
    affectedCount: affectedSymbols.length,
    riskLevel,
  });

  return { symbol, affectedSymbols, riskLevel };
}

// ── Helpers ──────────────────────────────────────────

/**
 * Extract records array from various GitNexus response formats.
 */
function extractRecords(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;

  const obj = raw as Record<string, unknown>;

  // { result: [...] } format
  if (Array.isArray(obj.result)) return obj.result as Array<Record<string, unknown>>;

  // { data: [...] } format
  if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>;

  // { records: [...] } format
  if (Array.isArray(obj.records)) return obj.records as Array<Record<string, unknown>>;

  return [];
}

/**
 * Extract node data from a Cypher result record.
 */
function extractNodeData(record: Record<string, unknown>, key: string): CodeSymbol | null {
  const node = record[key];
  if (node == null || typeof node !== "object") {
    // Check for flattened format (e.g., record itself has name/kind)
    if (key === "s" && typeof record.name === "string") {
      return {
        name: record.name as string,
        kind: (record.kind as string) ?? "unknown",
        file: record.file as string | undefined,
      };
    }
    return null;
  }

  const n = node as Record<string, unknown>;
  const name = typeof n.name === "string" ? n.name : undefined;
  if (!name) return null;

  return {
    name,
    kind: typeof n.kind === "string" ? n.kind : "unknown",
    file: typeof n.file === "string" ? n.file : undefined,
    startLine: typeof n.startLine === "number" ? n.startLine : undefined,
    endLine: typeof n.endLine === "number" ? n.endLine : undefined,
  };
}
