/**
 * Pattern Analyzer — learns naming conventions, field patterns, and structural patterns from Siebel objects.
 */

import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";

export interface NamingPattern {
  prefix: string;
  count: number;
  projects: string[];
}

export interface RequiredPropertyPattern {
  objectType: SiebelObjectType;
  properties: string[];
  frequency: Record<string, number>;
}

export interface FieldDistribution {
  avgFieldCount: number;
  minFieldCount: number;
  maxFieldCount: number;
  medianFieldCount: number;
}

export interface PatternAnalysisResult {
  namingPatterns: NamingPattern[];
  requiredProperties: RequiredPropertyPattern[];
  fieldDistribution: FieldDistribution;
  appletClassDistribution: Record<string, number>;
  computeAdherence: (obj: SiebelObject) => number;
}

/**
 * Analyze patterns from a collection of Siebel objects.
 */
export function analyzePatterns(objects: SiebelObject[]): PatternAnalysisResult {
  const namingPatterns = extractNamingPatterns(objects);
  const requiredProperties = extractRequiredProperties(objects);
  const fieldDistribution = computeFieldDistribution(objects);
  const appletClassDistribution = computeAppletClassDistribution(objects);

  const computeAdherence = (obj: SiebelObject): number => {
    return calculateAdherence(obj, namingPatterns, requiredProperties, appletClassDistribution);
  };

  return {
    namingPatterns,
    requiredProperties,
    fieldDistribution,
    appletClassDistribution,
    computeAdherence,
  };
}

function extractNamingPatterns(objects: SiebelObject[]): NamingPattern[] {
  const prefixMap = new Map<string, { count: number; projects: Set<string> }>();

  for (const obj of objects) {
    const parts = obj.name.split(" ");
    if (parts.length < 2) continue;

    const prefix = parts[0];
    // Only consider prefixes that look like abbreviations (2-5 chars, uppercase or mixed)
    if (prefix.length < 2 || prefix.length > 10) continue;

    const existing = prefixMap.get(prefix);
    if (existing) {
      existing.count++;
      if (obj.project) existing.projects.add(obj.project);
    } else {
      const projects = new Set<string>();
      if (obj.project) projects.add(obj.project);
      prefixMap.set(prefix, { count: 1, projects });
    }
  }

  // Only return prefixes used more than once
  return Array.from(prefixMap.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([prefix, v]) => ({
      prefix,
      count: v.count,
      projects: Array.from(v.projects),
    }))
    .sort((a, b) => b.count - a.count);
}

function extractRequiredProperties(objects: SiebelObject[]): RequiredPropertyPattern[] {
  const byType = new Map<SiebelObjectType, Map<string, number>>();
  const countByType = new Map<SiebelObjectType, number>();

  for (const obj of objects) {
    if (obj.parentName) continue; // skip children
    const typeMap = byType.get(obj.type) ?? new Map<string, number>();
    const count = (countByType.get(obj.type) ?? 0) + 1;
    countByType.set(obj.type, count);

    for (const prop of obj.properties) {
      typeMap.set(prop.name, (typeMap.get(prop.name) ?? 0) + 1);
    }
    byType.set(obj.type, typeMap);
  }

  const results: RequiredPropertyPattern[] = [];
  for (const [type, propMap] of byType.entries()) {
    const total = countByType.get(type) ?? 1;
    const frequency: Record<string, number> = {};
    const required: string[] = [];

    for (const [propName, count] of propMap.entries()) {
      const ratio = count / total;
      frequency[propName] = ratio;
      // Property present in >=80% of objects of this type is "required"
      if (ratio >= 0.8) {
        required.push(propName);
      }
    }

    results.push({
      objectType: type,
      properties: required.sort(),
      frequency,
    });
  }

  return results;
}

function computeFieldDistribution(objects: SiebelObject[]): FieldDistribution {
  const bcs = objects.filter((o) => o.type === "business_component" && !o.parentName);
  const fieldCounts = bcs.map((bc) => bc.children.filter((c) => c.type === "field").length);

  if (fieldCounts.length === 0) {
    return { avgFieldCount: 0, minFieldCount: 0, maxFieldCount: 0, medianFieldCount: 0 };
  }

  fieldCounts.sort((a, b) => a - b);
  const sum = fieldCounts.reduce((s, c) => s + c, 0);
  const mid = Math.floor(fieldCounts.length / 2);

  return {
    avgFieldCount: Math.round((sum / fieldCounts.length) * 100) / 100,
    minFieldCount: fieldCounts[0],
    maxFieldCount: fieldCounts[fieldCounts.length - 1],
    medianFieldCount: fieldCounts.length % 2 === 0
      ? (fieldCounts[mid - 1] + fieldCounts[mid]) / 2
      : fieldCounts[mid],
  };
}

function computeAppletClassDistribution(objects: SiebelObject[]): Record<string, number> {
  const dist: Record<string, number> = {};
  const applets = objects.filter((o) => o.type === "applet" && !o.parentName);

  for (const applet of applets) {
    const cls = applet.properties.find((p) => p.name === "CLASS")?.value;
    if (cls) {
      dist[cls] = (dist[cls] ?? 0) + 1;
    }
  }

  return dist;
}

function calculateAdherence(
  obj: SiebelObject,
  namingPatterns: NamingPattern[],
  requiredProps: RequiredPropertyPattern[],
  appletClassDist: Record<string, number>,
): number {
  let score = 0;
  let checks = 0;

  // Check naming pattern adherence (30 pts)
  checks++;
  if (namingPatterns.length > 0) {
    const firstWord = obj.name.split(" ")[0];
    const matchesKnownPrefix = namingPatterns.some((p) => p.prefix === firstWord);
    if (matchesKnownPrefix) score += 30;
  } else {
    score += 15; // neutral if no patterns known
  }

  // Check required properties (40 pts)
  const typeProps = requiredProps.find((r) => r.objectType === obj.type);
  if (typeProps && typeProps.properties.length > 0) {
    checks++;
    const objPropNames = new Set(obj.properties.map((p) => p.name));
    const matched = typeProps.properties.filter((p) => objPropNames.has(p)).length;
    score += Math.round((matched / typeProps.properties.length) * 40);
  }

  // Check applet class (30 pts)
  if (obj.type === "applet") {
    checks++;
    const cls = obj.properties.find((p) => p.name === "CLASS")?.value;
    if (cls && appletClassDist[cls]) {
      score += 30;
    }
  } else {
    score += 30; // non-applet gets full marks for this check
  }

  return Math.min(100, score);
}
