/**
 * Siebel Dependency Analyzer — impact analysis, dependency chains, and circular dep detection.
 */

import type {
  SiebelDependency,
  SiebelObjectRef,
  SiebelImpactResult,
} from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

export interface DependencyPath {
  path: SiebelObjectRef[];
}

export interface CircularDep {
  cycle: SiebelObjectRef[];
}

/**
 * Analyze blast radius of modifying a Siebel object.
 * Finds all direct and transitive dependents.
 */
export function analyzeSiebelImpact(
  dependencies: SiebelDependency[],
  target: SiebelObjectRef,
): SiebelImpactResult {
  const targetKey = refKey(target);

  // Build reverse adjacency: target → objects that depend ON target
  const reverseDeps = new Map<string, SiebelObjectRef[]>();
  for (const dep of dependencies) {
    const toKey = refKey(dep.to);
    if (!reverseDeps.has(toKey)) {
      reverseDeps.set(toKey, []);
    }
    const arr = reverseDeps.get(toKey);
    if (arr) arr.push(dep.from);
  }

  // BFS for direct dependents
  const directDependents = reverseDeps.get(targetKey) ?? [];

  // BFS for transitive dependents
  const visited = new Set<string>([targetKey]);
  const allDependents: SiebelObjectRef[] = [];
  const queue = [...directDependents];

  for (const dep of directDependents) {
    visited.add(refKey(dep));
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    allDependents.push(current);
    const currentKey = refKey(current);
    const nextDeps = reverseDeps.get(currentKey) ?? [];

    for (const next of nextDeps) {
      const nextKey = refKey(next);
      if (!visited.has(nextKey)) {
        visited.add(nextKey);
        queue.push(next);
      }
    }
  }

  // Transitive = all minus direct
  const directKeys = new Set(directDependents.map(refKey));
  const transitiveDependents = allDependents.filter((d) => !directKeys.has(refKey(d)));

  const totalAffected = allDependents.length;
  const riskLevel = calculateRisk(totalAffected);

  logger.debug("Siebel impact analysis", {
    target: targetKey,
    direct: String(directDependents.length),
    transitive: String(transitiveDependents.length),
    risk: riskLevel,
  });

  return {
    targetObject: target,
    directDependents: deduplicateRefs(directDependents),
    transitiveDependents: deduplicateRefs(transitiveDependents),
    totalAffected,
    riskLevel,
  };
}

/**
 * Find dependency chain(s) from one object to another.
 */
export function findDependencyChain(
  dependencies: SiebelDependency[],
  from: SiebelObjectRef,
  to: SiebelObjectRef,
): DependencyPath[] {
  // Build forward adjacency: from → to
  const forwardDeps = new Map<string, SiebelObjectRef[]>();
  for (const dep of dependencies) {
    const fromKey = refKey(dep.from);
    if (!forwardDeps.has(fromKey)) {
      forwardDeps.set(fromKey, []);
    }
    const fArr = forwardDeps.get(fromKey);
    if (fArr) fArr.push(dep.to);
  }

  const targetKey = refKey(to);
  const paths: DependencyPath[] = [];

  // DFS to find all paths
  function dfs(current: SiebelObjectRef, path: SiebelObjectRef[], visited: Set<string>): void {
    if (refKey(current) === targetKey) {
      paths.push({ path: [...path, current] });
      return;
    }

    const neighbors = forwardDeps.get(refKey(current)) ?? [];
    for (const neighbor of neighbors) {
      const nKey = refKey(neighbor);
      if (!visited.has(nKey)) {
        visited.add(nKey);
        dfs(neighbor, [...path, current], visited);
        visited.delete(nKey);
      }
    }
  }

  const visited = new Set<string>([refKey(from)]);
  dfs(from, [], visited);

  return paths;
}

/**
 * Detect circular dependencies in the dependency graph.
 */
export function detectCircularDeps(dependencies: SiebelDependency[]): CircularDep[] {
  const forwardDeps = new Map<string, SiebelObjectRef[]>();
  const allRefs = new Map<string, SiebelObjectRef>();

  for (const dep of dependencies) {
    const fromKey = refKey(dep.from);
    if (!forwardDeps.has(fromKey)) {
      forwardDeps.set(fromKey, []);
    }
    const cArr = forwardDeps.get(fromKey);
    if (cArr) cArr.push(dep.to);
    allRefs.set(fromKey, dep.from);
    allRefs.set(refKey(dep.to), dep.to);
  }

  const cycles: CircularDep[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeKey: string, path: string[]): void {
    if (inStack.has(nodeKey)) {
      // Found a cycle — extract it
      const cycleStart = path.indexOf(nodeKey);
      if (cycleStart !== -1) {
        const cyclePath = path.slice(cycleStart).map((k) => allRefs.get(k)).filter((r): r is SiebelObjectRef => r !== undefined);
        cycles.push({ cycle: cyclePath });
      }
      return;
    }

    if (visited.has(nodeKey)) return;

    visited.add(nodeKey);
    inStack.add(nodeKey);
    path.push(nodeKey);

    const neighbors = forwardDeps.get(nodeKey) ?? [];
    for (const neighbor of neighbors) {
      dfs(refKey(neighbor), [...path]);
    }

    inStack.delete(nodeKey);
  }

  for (const key of allRefs.keys()) {
    if (!visited.has(key)) {
      dfs(key, []);
    }
  }

  return cycles;
}

function refKey(ref: SiebelObjectRef): string {
  return `${ref.type}:${ref.name}`;
}

function calculateRisk(affected: number): "low" | "medium" | "high" | "critical" {
  if (affected === 0) return "low";
  if (affected <= 2) return "low";
  if (affected <= 5) return "medium";
  if (affected <= 10) return "high";
  return "critical";
}

function deduplicateRefs(refs: SiebelObjectRef[]): SiebelObjectRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = refKey(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
