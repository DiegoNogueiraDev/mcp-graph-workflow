/**
 * Orphan Detector — identifies Siebel objects not referenced by any other object.
 */

import type { SiebelObject, SiebelObjectRef, SiebelDependency } from "../../schemas/siebel.schema.js";

export type OrphanClassification = "definitely_orphan" | "probably_orphan" | "intentionally_standalone";

/** Types that are commonly standalone (not orphans even without inbound deps). */
const STANDALONE_TYPES = new Set(["business_service", "workflow", "integration_object", "web_template"]);

export interface OrphanObject {
  object: SiebelObjectRef;
  classification: OrphanClassification;
  reason: string;
}

export interface OrphanResult {
  orphans: OrphanObject[];
  totalScanned: number;
  orphanCount: number;
  orphanRate: number;
}

/**
 * Detect orphan objects — those not referenced by any other object in the dependency graph.
 */
export function detectOrphans(
  objects: SiebelObject[],
  dependencies: SiebelDependency[],
): OrphanResult {
  if (objects.length === 0) {
    return { orphans: [], totalScanned: 0, orphanCount: 0, orphanRate: 0 };
  }

  // Build set of objects that are referenced (have inbound dependencies)
  const referenced = new Set<string>();
  for (const dep of dependencies) {
    referenced.add(`${dep.to.type}:${dep.to.name}`);
  }

  // Also mark objects that HAVE outbound deps (they reference something, so they are "active")
  const hasOutbound = new Set<string>();
  for (const dep of dependencies) {
    hasOutbound.add(`${dep.from.type}:${dep.from.name}`);
  }

  const orphans: OrphanObject[] = [];

  for (const obj of objects) {
    if (obj.parentName) continue; // skip children
    const key = `${obj.type}:${obj.name}`;

    // If referenced by something, not an orphan
    if (referenced.has(key)) continue;

    // Standalone types are intentional
    if (STANDALONE_TYPES.has(obj.type)) {
      orphans.push({
        object: { name: obj.name, type: obj.type },
        classification: "intentionally_standalone",
        reason: `${obj.type} objects are commonly standalone`,
      });
      continue;
    }

    // Has outbound deps but no inbound — probably orphan (it uses things but nothing uses it)
    if (hasOutbound.has(key)) {
      orphans.push({
        object: { name: obj.name, type: obj.type },
        classification: "probably_orphan",
        reason: `References other objects but not referenced by anything`,
      });
      continue;
    }

    // No deps at all — definitely orphan
    orphans.push({
      object: { name: obj.name, type: obj.type },
      classification: "definitely_orphan",
      reason: `No inbound or outbound dependencies`,
    });
  }

  const orphanCount = orphans.filter((o) => o.classification !== "intentionally_standalone").length;

  return {
    orphans,
    totalScanned: objects.length,
    orphanCount,
    orphanRate: objects.length > 0 ? orphanCount / objects.length : 0,
  };
}
