/**
 * Automatic Context Enrichment — generates summary, dependency info,
 * and usage analysis for imported SIF content.
 */

import type {
  SiebelObject,
  SiebelObjectRef,
  SiebelDependency,
  SiebelObjectType,
} from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Public types ---

export interface EnrichmentRequest {
  readonly objects: readonly SiebelObject[];
  readonly dependencies: readonly SiebelDependency[];
}

export interface EnrichmentResult {
  readonly summary: string;
  readonly objectTypes: readonly SiebelObjectType[];
  readonly dependsOn: readonly SiebelObjectRef[];
  readonly usedBy: readonly SiebelObjectRef[];
  readonly objectCount: number;
}

// --- Implementation ---

function buildSummary(objects: readonly SiebelObject[]): string {
  if (objects.length === 0) return "Empty SIF — no objects.";

  const typeCounts = new Map<string, number>();
  const entityNames = new Set<string>();

  for (const obj of objects) {
    typeCounts.set(obj.type, (typeCounts.get(obj.type) ?? 0) + 1);

    // Extract entity name (strip prefix and type suffix)
    const entity = obj.name
      .replace(/^[A-Z]{2,4}[_ ]\s*/i, "")
      .replace(/\s*(BC|Applet|View|Screen|BO|IO|List|Form)$/gi, "")
      .trim();
    if (entity) entityNames.add(entity);
  }

  const typeList = [...typeCounts.entries()]
    .map(([t, c]) => `${c} ${t}${c > 1 ? "s" : ""}`)
    .join(", ");

  const entities = [...entityNames].slice(0, 5).join(", ");

  return `SIF with ${objects.length} objects (${typeList}). Main entities: ${entities || "unknown"}.`;
}

function findDependsOn(
  objects: readonly SiebelObject[],
  dependencies: readonly SiebelDependency[],
): SiebelObjectRef[] {
  const objectKeys = new Set(objects.map((o) => `${o.type}:${o.name}`));
  const external: SiebelObjectRef[] = [];
  const seen = new Set<string>();

  // Dependencies where our objects depend on something external
  for (const dep of dependencies) {
    const fromKey = `${dep.from.type}:${dep.from.name}`;
    const toKey = `${dep.to.type}:${dep.to.name}`;

    if (objectKeys.has(fromKey) && !objectKeys.has(toKey) && !seen.has(toKey)) {
      seen.add(toKey);
      external.push(dep.to);
    }
  }

  // Also check BUS_COMP references in applets
  for (const obj of objects) {
    if (obj.type === "applet") {
      const busComp = obj.properties.find((p) => p.name === "BUS_COMP")?.value;
      if (busComp) {
        const key = `business_component:${busComp}`;
        if (!objectKeys.has(key) && !seen.has(key)) {
          seen.add(key);
          external.push({ name: busComp, type: "business_component" });
        }
      }
    }
  }

  return external;
}

function findUsedBy(
  objects: readonly SiebelObject[],
  dependencies: readonly SiebelDependency[],
): SiebelObjectRef[] {
  const objectKeys = new Set(objects.map((o) => `${o.type}:${o.name}`));
  const users: SiebelObjectRef[] = [];
  const seen = new Set<string>();

  for (const dep of dependencies) {
    const fromKey = `${dep.from.type}:${dep.from.name}`;
    const toKey = `${dep.to.type}:${dep.to.name}`;

    if (objectKeys.has(toKey) && !objectKeys.has(fromKey) && !seen.has(fromKey)) {
      seen.add(fromKey);
      users.push(dep.from);
    }
  }

  return users;
}

// --- Main function ---

export function enrichSifContext(request: EnrichmentRequest): EnrichmentResult {
  const { objects, dependencies } = request;

  logger.debug("context-enrichment: enriching", { objects: objects.length, deps: dependencies.length });

  const summary = buildSummary(objects);
  const objectTypes = [...new Set(objects.map((o) => o.type))];
  const dependsOn = findDependsOn(objects, dependencies);
  const usedBy = findUsedBy(objects, dependencies);

  logger.info("context-enrichment: complete", {
    types: objectTypes.length,
    dependsOn: dependsOn.length,
    usedBy: usedBy.length,
  });

  return {
    summary,
    objectTypes,
    dependsOn,
    usedBy,
    objectCount: objects.length,
  };
}
