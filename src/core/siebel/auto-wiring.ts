/**
 * Auto-Wiring de Dependências — automatically detects and wires dependencies
 * for new Siebel objects based on their references and the existing repository.
 *
 * Dependency rules:
 *   Applet  → BC        (via BUS_COMP property)
 *   View    → Applet    (via children of type applet)
 *   BC      → Table     (suggest from similar BCs if TABLE property missing)
 *   BO      → BC        (via children of type business_component)
 *   Screen  → View      (via children of type view)
 */

import type {
  SiebelObject,
  SiebelObjectRef,
  SiebelDependency,
  SiebelDependencyRelation,
} from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Public types ---

export interface AutoWireRequest {
  readonly newObjects: readonly SiebelObject[];
  readonly repository: readonly SiebelObject[];
}

export interface MissingDependency {
  readonly from: SiebelObjectRef;
  readonly to: SiebelObjectRef;
  readonly relationType: SiebelDependencyRelation;
  readonly suggestion: "create" | "link";
}

export interface AutoWireResult {
  readonly wiredEdges: readonly SiebelDependency[];
  readonly missingDependencies: readonly MissingDependency[];
  readonly report: string;
}

// --- Helpers ---

function refKey(ref: SiebelObjectRef): string {
  return `${ref.type}:${ref.name}`;
}

function buildObjectIndex(objects: readonly SiebelObject[]): Map<string, SiebelObject> {
  const index = new Map<string, SiebelObject>();
  for (const obj of objects) {
    index.set(refKey({ name: obj.name, type: obj.type }), obj);
  }
  return index;
}

function findSimilarBC(
  bcName: string,
  repository: readonly SiebelObject[],
): SiebelObject | undefined {
  const repoBCs = repository.filter((o) => o.type === "business_component");
  if (repoBCs.length === 0) return undefined;

  // Extract entity keyword from BC name (strip prefixes and "BC" suffix)
  const entity = bcName
    .replace(/^[A-Z]{2,4}_\s*/i, "")
    .replace(/\s*BC$/i, "")
    .trim()
    .toLowerCase();

  // Find BC with most similar entity name
  let best: SiebelObject | undefined;
  let bestScore = 0;

  for (const bc of repoBCs) {
    const repoEntity = bc.name
      .replace(/^[A-Z]{2,4}_\s*/i, "")
      .replace(/\s*BC$/i, "")
      .trim()
      .toLowerCase();

    if (repoEntity === entity) {
      return bc; // Exact entity match
    }

    // Simple word overlap score
    const words = entity.split(/\s+/);
    const repoWords = repoEntity.split(/\s+/);
    const overlap = words.filter((w) => repoWords.includes(w)).length;
    const score = overlap / Math.max(words.length, repoWords.length);
    if (score > bestScore) {
      bestScore = score;
      best = bc;
    }
  }

  return bestScore >= 0.5 ? best : undefined;
}

// --- Dependency detection rules ---

interface DetectedDep {
  from: SiebelObjectRef;
  to: SiebelObjectRef;
  relationType: SiebelDependencyRelation;
}

function detectAppletDeps(obj: SiebelObject): DetectedDep[] {
  if (obj.type !== "applet") return [];
  const deps: DetectedDep[] = [];

  const busComp = obj.properties.find((p) => p.name === "BUS_COMP")?.value;
  if (busComp) {
    deps.push({
      from: { name: obj.name, type: obj.type },
      to: { name: busComp, type: "business_component" },
      relationType: "references",
    });
  }

  return deps;
}

function detectViewDeps(obj: SiebelObject): DetectedDep[] {
  if (obj.type !== "view") return [];
  const deps: DetectedDep[] = [];

  // View references applets via children
  const appletChildren = obj.children.filter((c) => c.type === "applet");
  for (const child of appletChildren) {
    deps.push({
      from: { name: obj.name, type: obj.type },
      to: { name: child.name, type: "applet" },
      relationType: "references",
    });
  }

  return deps;
}

function detectBODeps(obj: SiebelObject): DetectedDep[] {
  if (obj.type !== "business_object") return [];
  const deps: DetectedDep[] = [];

  // BO references BCs via children
  const bcChildren = obj.children.filter((c) => c.type === "business_component");
  for (const child of bcChildren) {
    deps.push({
      from: { name: obj.name, type: obj.type },
      to: { name: child.name, type: "business_component" },
      relationType: "contains",
    });
  }

  return deps;
}

function detectScreenDeps(obj: SiebelObject): DetectedDep[] {
  if (obj.type !== "screen") return [];
  const deps: DetectedDep[] = [];

  const viewChildren = obj.children.filter((c) => c.type === "view");
  for (const child of viewChildren) {
    deps.push({
      from: { name: obj.name, type: obj.type },
      to: { name: child.name, type: "view" },
      relationType: "references",
    });
  }

  return deps;
}

function detectBCTableDep(
  obj: SiebelObject,
  repository: readonly SiebelObject[],
): MissingDependency | undefined {
  if (obj.type !== "business_component") return undefined;

  // If BC already has TABLE property, no suggestion needed
  const hasTable = obj.properties.some((p) => p.name === "TABLE" && p.value);
  if (hasTable) return undefined;

  const similar = findSimilarBC(obj.name, repository);
  if (!similar) return undefined;

  const tableName = similar.properties.find((p) => p.name === "TABLE")?.value;
  if (!tableName) return undefined;

  return {
    from: { name: obj.name, type: obj.type },
    to: { name: tableName, type: "table" },
    relationType: "based_on",
    suggestion: "link",
  };
}

// --- Report generation ---

function generateReport(
  wired: readonly SiebelDependency[],
  missing: readonly MissingDependency[],
): string {
  const lines: string[] = ["# Auto-Wiring Report", ""];

  if (wired.length > 0) {
    lines.push(`## Wired Dependencies (${wired.length})`, "");
    for (const edge of wired) {
      lines.push(`- ✓ ${edge.from.type}:\`${edge.from.name}\` → ${edge.to.type}:\`${edge.to.name}\` (${edge.relationType})`);
    }
    lines.push("");
  }

  if (missing.length > 0) {
    lines.push(`## Missing Dependencies (${missing.length})`, "");
    for (const dep of missing) {
      const action = dep.suggestion === "create" ? "CREATE" : "LINK";
      lines.push(`- ✗ ${dep.from.type}:\`${dep.from.name}\` → ${dep.to.type}:\`${dep.to.name}\` — **${action}** (${dep.relationType})`);
    }
    lines.push("");
  }

  if (wired.length === 0 && missing.length === 0) {
    lines.push("No dependencies detected.", "");
  }

  return lines.join("\n");
}

// --- Main function ---

export function autoWireDependencies(request: AutoWireRequest): AutoWireResult {
  const { newObjects, repository } = request;

  logger.debug("auto-wiring: analyzing dependencies", {
    newCount: newObjects.length,
    repoCount: repository.length,
  });

  // Build combined index of all known objects (repo + new)
  const allKnown = buildObjectIndex([...repository, ...newObjects]);
  const _repoIndex = buildObjectIndex(repository);

  const wiredEdges: SiebelDependency[] = [];
  const missingDependencies: MissingDependency[] = [];

  // Detect structural dependencies for each new object
  const detectors = [detectAppletDeps, detectViewDeps, detectBODeps, detectScreenDeps];

  for (const obj of newObjects) {
    for (const detect of detectors) {
      const deps = detect(obj);
      for (const dep of deps) {
        const targetKey = refKey(dep.to);
        if (allKnown.has(targetKey)) {
          // Target exists — wire it
          wiredEdges.push({
            from: dep.from,
            to: dep.to,
            relationType: dep.relationType,
            inferred: true,
          });
        } else {
          // Target missing — suggest creation
          missingDependencies.push({
            from: dep.from,
            to: dep.to,
            relationType: dep.relationType,
            suggestion: "create",
          });
        }
      }
    }

    // BC → Table suggestion (separate logic)
    const tableDep = detectBCTableDep(obj, repository);
    if (tableDep) {
      missingDependencies.push(tableDep);
    }
  }

  const report = generateReport(wiredEdges, missingDependencies);

  logger.info("auto-wiring: complete", {
    wired: wiredEdges.length,
    missing: missingDependencies.length,
  });

  return { wiredEdges, missingDependencies, report };
}
