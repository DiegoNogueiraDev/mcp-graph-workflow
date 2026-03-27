/**
 * Complexity Metrics — calculates complexity scores for Siebel objects.
 */

import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

export type ComplexityLevel = "low" | "medium" | "high" | "critical";

export interface ObjectMetrics {
  fieldCount: number;
  scriptCount: number;
  userPropCount: number;
  childCount: number;
  dependencyCount: number;
}

export interface ComplexityResult {
  name: string;
  type: string;
  metrics: ObjectMetrics;
  score: number;
  level: ComplexityLevel;
}

/**
 * Calculate complexity metrics for all top-level objects, ranked by score.
 */
export function calculateComplexity(
  objects: SiebelObject[],
  dependencies: SiebelDependency[],
): ComplexityResult[] {
  const topLevel = objects.filter((o) => !o.parentName);

  const depCount = new Map<string, number>();
  for (const dep of dependencies) {
    const key = `${dep.from.type}:${dep.from.name}`;
    depCount.set(key, (depCount.get(key) ?? 0) + 1);
  }

  const results: ComplexityResult[] = topLevel.map((obj) => {
    const metrics: ObjectMetrics = {
      fieldCount: obj.children.filter((c) => c.type === "field").length,
      scriptCount: obj.children.filter((c) => c.type === "escript").length,
      userPropCount: obj.children.filter((c) => c.type === "user_property").length,
      childCount: obj.children.length,
      dependencyCount: depCount.get(`${obj.type}:${obj.name}`) ?? 0,
    };

    const score = metrics.fieldCount * 1
      + metrics.scriptCount * 5
      + metrics.userPropCount * 2
      + metrics.dependencyCount * 3;

    const level = scoreToLevel(score);

    return { name: obj.name, type: obj.type, metrics, score, level };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

function scoreToLevel(score: number): ComplexityLevel {
  if (score >= 100) return "critical";
  if (score >= 50) return "high";
  if (score >= 20) return "medium";
  return "low";
}
