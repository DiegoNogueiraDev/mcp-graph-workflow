/**
 * Change Simulator — simulates the impact of a change before executing it.
 * Propagates impact through the dependency chain with severity scoring.
 */

import type { SiebelObject, SiebelObjectRef, SiebelDependency } from "../../schemas/siebel.schema.js";

export type ChangeAction = "rename_field" | "add_field" | "remove_field" | "change_type" | "modify_bc" | "remove_applet";
export type Severity = "breaking" | "warning" | "info";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ChangeProposal {
  action: ChangeAction;
  targetObject: SiebelObjectRef;
  fieldName?: string;
  newFieldName?: string;
}

export interface AffectedObject {
  object: SiebelObjectRef;
  severity: Severity;
  reason: string;
  suggestedAction: string;
  depth: number;
}

export interface SimulationResult {
  proposal: ChangeProposal;
  affectedObjects: AffectedObject[];
  riskScore: number;
  riskLevel: RiskLevel;
}

/**
 * Simulate the impact of a proposed change across the dependency graph.
 */
export function simulateChange(
  objects: SiebelObject[],
  dependencies: SiebelDependency[],
  proposal: ChangeProposal,
): SimulationResult {
  const objectIndex = new Map<string, SiebelObject>();
  for (const obj of objects) {
    objectIndex.set(`${obj.type}:${obj.name}`, obj);
  }

  const target = objectIndex.get(`${proposal.targetObject.type}:${proposal.targetObject.name}`);
  if (!target) {
    return { proposal, affectedObjects: [], riskScore: 0, riskLevel: "low" };
  }

  const affected: AffectedObject[] = [];

  if (proposal.action === "add_field") {
    // Adding a field is non-breaking — just info for dependents
    const dependents = findDependents(proposal.targetObject, dependencies);
    for (const dep of dependents) {
      affected.push({
        object: dep.ref,
        severity: "info",
        reason: `New field "${proposal.fieldName}" added to dependency`,
        suggestedAction: "no-action",
        depth: dep.depth,
      });
    }
  } else if (proposal.action === "remove_field" || proposal.action === "rename_field") {
    const fieldName = proposal.fieldName ?? "";

    // Find direct dependents (applets using this BC)
    const directDeps = findDependents(proposal.targetObject, dependencies);

    for (const dep of directDeps) {
      const depObj = objectIndex.get(`${dep.ref.type}:${dep.ref.name}`);
      if (!depObj) continue;

      // Check if the dependent references the field
      const referencesField = depObj.children.some((child) => {
        const fieldProp = child.properties.find((p) => p.name === "FIELD");
        return fieldProp?.value === fieldName;
      });

      if (referencesField) {
        affected.push({
          object: dep.ref,
          severity: "breaking",
          reason: proposal.action === "remove_field"
            ? `Control references removed field "${fieldName}"`
            : `Control references renamed field "${fieldName}" → "${proposal.newFieldName}"`,
          suggestedAction: "update",
          depth: dep.depth,
        });
      } else if (dep.depth === 1) {
        affected.push({
          object: dep.ref,
          severity: "warning",
          reason: `Direct dependent of modified BC`,
          suggestedAction: "review",
          depth: dep.depth,
        });
      } else {
        affected.push({
          object: dep.ref,
          severity: "info",
          reason: `Transitive dependent (depth ${dep.depth})`,
          suggestedAction: "no-action",
          depth: dep.depth,
        });
      }
    }
  }

  const riskScore = computeRiskScore(affected);
  const riskLevel = scoreToLevel(riskScore);

  return { proposal, affectedObjects: affected, riskScore, riskLevel };
}

// ---- Helpers ----

interface DepRef {
  ref: SiebelObjectRef;
  depth: number;
}

function findDependents(
  target: SiebelObjectRef,
  dependencies: SiebelDependency[],
): DepRef[] {
  const result: DepRef[] = [];
  const visited = new Set<string>();
  const queue: DepRef[] = [];

  // Find objects that depend ON the target (reverse lookup)
  const key = `${target.type}:${target.name}`;
  visited.add(key);

  for (const dep of dependencies) {
    const toKey = `${dep.to.type}:${dep.to.name}`;
    if (toKey === key) {
      const fromKey = `${dep.from.type}:${dep.from.name}`;
      if (!visited.has(fromKey)) {
        visited.add(fromKey);
        const ref: DepRef = { ref: dep.from, depth: 1 };
        result.push(ref);
        queue.push(ref);
      }
    }
  }

  // BFS for transitive dependents
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.ref.type}:${current.ref.name}`;

    for (const dep of dependencies) {
      const toKey = `${dep.to.type}:${dep.to.name}`;
      if (toKey === currentKey) {
        const fromKey = `${dep.from.type}:${dep.from.name}`;
        if (!visited.has(fromKey)) {
          visited.add(fromKey);
          const ref: DepRef = { ref: dep.from, depth: current.depth + 1 };
          result.push(ref);
          queue.push(ref);
        }
      }
    }
  }

  return result;
}

function computeRiskScore(affected: AffectedObject[]): number {
  let score = 0;
  for (const a of affected) {
    if (a.severity === "breaking") score += 30;
    else if (a.severity === "warning") score += 10;
    else score += 2;
  }
  return score;
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 60) return "critical";
  if (score >= 30) return "high";
  if (score >= 10) return "medium";
  return "low";
}
