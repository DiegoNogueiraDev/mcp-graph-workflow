/**
 * Migration Package Builder — builds deploy packages from modified Siebel objects
 * with transitive dependency resolution, topological ordering, lock conflict
 * detection, and per-environment deploy scripts.
 */

import type {
  SiebelObject,
  SiebelObjectRef,
  SiebelDependency,
  SiebelObjectType,
} from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Constants ---

/** Canonical deploy order for Siebel object types */
export const DEPLOY_ORDER: readonly SiebelObjectType[] = [
  "table",
  "column",
  "field",
  "pick_list",
  "link",
  "business_component",
  "business_object",
  "business_service",
  "integration_object",
  "workflow",
  "web_template",
  "web_template_item",
  "applet",
  "control",
  "list_column",
  "menu_item",
  "user_property",
  "view",
  "screen",
  "application",
  "project",
  "escript",
];

// --- Public types ---

export interface MigrationPackageRequest {
  readonly modifiedObjects: readonly SiebelObject[];
  readonly allObjects: readonly SiebelObject[];
  readonly dependencies: readonly SiebelDependency[];
  readonly currentUser?: string;
  readonly environments?: readonly string[];
}

export interface LockConflict {
  readonly objectName: string;
  readonly objectType: SiebelObjectType;
  readonly lockedBy: string;
}

export interface DeployScript {
  readonly environment: string;
  readonly commands: readonly string[];
}

export interface CircularDepInfo {
  readonly objects: readonly SiebelObjectRef[];
}

export interface MigrationPackage {
  readonly objects: readonly SiebelObjectRef[];
  readonly deployOrder: readonly SiebelObjectRef[];
  readonly conflicts: readonly LockConflict[];
  readonly circularDeps: readonly CircularDepInfo[];
  readonly deployScripts: readonly DeployScript[];
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly report: string;
}

// --- Helpers ---

function refKey(ref: SiebelObjectRef): string {
  return `${ref.type}:${ref.name}`;
}

function objToRef(obj: SiebelObject): SiebelObjectRef {
  return { name: obj.name, type: obj.type };
}

/** AC2: Resolve transitive dependents (objects that depend ON modified objects) */
function resolveTransitiveDependents(
  modifiedRefs: Set<string>,
  allObjects: readonly SiebelObject[],
  dependencies: readonly SiebelDependency[],
): SiebelObjectRef[] {
  // Build reverse adjacency: "to" → list of "from" (objects that reference "to")
  const reverseDeps = new Map<string, SiebelObjectRef[]>();
  for (const dep of dependencies) {
    const toKey = refKey(dep.to);
    if (!reverseDeps.has(toKey)) {
      reverseDeps.set(toKey, []);
    }
    reverseDeps.get(toKey)!.push(dep.from);
  }

  const visited = new Set<string>(modifiedRefs);
  const result: SiebelObjectRef[] = [];
  const queue = [...modifiedRefs];

  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    const dependents = reverseDeps.get(currentKey) ?? [];

    for (const dep of dependents) {
      const depKey = refKey(dep);
      if (!visited.has(depKey)) {
        visited.add(depKey);
        result.push(dep);
        queue.push(depKey);
      }
    }
  }

  return result;
}

/** AC3: Sort by deploy order */
function sortByDeployOrder(refs: readonly SiebelObjectRef[]): SiebelObjectRef[] {
  return [...refs].sort((a, b) => {
    const aIdx = DEPLOY_ORDER.indexOf(a.type);
    const bIdx = DEPLOY_ORDER.indexOf(b.type);
    const aOrder = aIdx === -1 ? DEPLOY_ORDER.length : aIdx;
    const bOrder = bIdx === -1 ? DEPLOY_ORDER.length : bIdx;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

/** AC5: Detect lock conflicts */
function detectLockConflicts(
  objects: readonly SiebelObject[],
  packageRefs: Set<string>,
  currentUser?: string,
): LockConflict[] {
  const conflicts: LockConflict[] = [];

  for (const obj of objects) {
    const key = refKey(objToRef(obj));
    if (!packageRefs.has(key)) continue;

    const locked = obj.properties.find((p) => p.name === "OBJECT_LOCKED")?.value;
    const lockedBy = obj.properties.find((p) => p.name === "LOCKED_BY")?.value;

    if (locked === "Y" && lockedBy && lockedBy !== currentUser) {
      conflicts.push({
        objectName: obj.name,
        objectType: obj.type,
        lockedBy,
      });
    }
  }

  return conflicts;
}

/** Detect circular dependencies within the package */
function detectCircularDeps(
  packageRefs: Set<string>,
  dependencies: readonly SiebelDependency[],
): CircularDepInfo[] {
  const circulars: CircularDepInfo[] = [];
  const adj = new Map<string, string[]>();

  for (const dep of dependencies) {
    const fromKey = refKey(dep.from);
    const toKey = refKey(dep.to);
    if (packageRefs.has(fromKey) && packageRefs.has(toKey)) {
      if (!adj.has(fromKey)) adj.set(fromKey, []);
      adj.get(fromKey)!.push(toKey);
    }
  }

  // Simple cycle detection via DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        circulars.push({
          objects: cycle.map((k) => {
            const [type, ...nameParts] = k.split(":");
            return { name: nameParts.join(":"), type: type as SiebelObjectType };
          }),
        });
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);

    for (const neighbor of adj.get(node) ?? []) {
      dfs(neighbor, [...path, node]);
    }

    inStack.delete(node);
  }

  for (const key of packageRefs) {
    if (!visited.has(key)) {
      dfs(key, []);
    }
  }

  return circulars;
}

/** AC6: Generate deploy scripts */
function generateDeployScripts(
  deployOrder: readonly SiebelObjectRef[],
  environments: readonly string[],
): DeployScript[] {
  return environments.map((env) => {
    const commands: string[] = [
      `# Deploy script for ${env.toUpperCase()}`,
      `# Generated: ${new Date().toISOString().split("T")[0]}`,
      `# Objects: ${deployOrder.length}`,
      "",
    ];

    // Group by type for batch import
    const byType = new Map<string, SiebelObjectRef[]>();
    for (const ref of deployOrder) {
      if (!byType.has(ref.type)) byType.set(ref.type, []);
      byType.get(ref.type)!.push(ref);
    }

    for (const [type, refs] of byType) {
      commands.push(`# --- ${type} (${refs.length}) ---`);
      for (const ref of refs) {
        commands.push(`srvrmgr> import sif ${ref.name}.sif`);
      }
      commands.push("");
    }

    commands.push(`# Compile all`);
    commands.push(`srvrmgr> compile project`);

    return { environment: env, commands };
  });
}

/** Calculate risk level */
function calculateRisk(objectCount: number, conflicts: number, circulars: number): "low" | "medium" | "high" | "critical" {
  if (circulars > 0 || conflicts > 2) return "critical";
  if (objectCount > 20 || conflicts > 0) return "high";
  if (objectCount > 10) return "medium";
  return "low";
}

/** AC4: Generate impact report */
function generateReport(
  pkg: {
    objects: readonly SiebelObjectRef[];
    deployOrder: readonly SiebelObjectRef[];
    conflicts: readonly LockConflict[];
    circularDeps: readonly CircularDepInfo[];
    riskLevel: string;
    modifiedCount: number;
    transitiveCount: number;
  },
): string {
  const lines: string[] = [
    "# Migration Package Report",
    "",
    `## Summary`,
    `- **Modified objects**: ${pkg.modifiedCount}`,
    `- **Transitive dependents**: ${pkg.transitiveCount}`,
    `- **Total in package**: ${pkg.objects.length}`,
    `- **Risk level**: ${pkg.riskLevel.toUpperCase()}`,
    "",
    "## Impact — Deploy Order",
    "",
  ];

  for (const ref of pkg.deployOrder) {
    lines.push(`- ${ref.type}: \`${ref.name}\``);
  }

  if (pkg.conflicts.length > 0) {
    lines.push("", "## Lock Conflicts", "");
    for (const c of pkg.conflicts) {
      lines.push(`- ⚠ \`${c.objectName}\` (${c.objectType}) locked by **${c.lockedBy}**`);
    }
  }

  if (pkg.circularDeps.length > 0) {
    lines.push("", "## Circular Dependencies", "");
    for (const cd of pkg.circularDeps) {
      lines.push(`- 🔄 ${cd.objects.map((o) => `${o.type}:${o.name}`).join(" → ")}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

// --- Main function ---

export function buildMigrationPackage(request: MigrationPackageRequest): MigrationPackage {
  const {
    modifiedObjects,
    allObjects,
    dependencies,
    currentUser,
    environments = ["dev", "test", "staging", "prod"],
  } = request;

  logger.debug("migration-package: building", {
    modified: modifiedObjects.length,
    total: allObjects.length,
    deps: dependencies.length,
  });

  // Collect modified refs
  const modifiedRefs = new Set(modifiedObjects.map((o) => refKey(objToRef(o))));
  const modifiedObjRefs = modifiedObjects.map(objToRef);

  // AC2: Resolve transitive dependents
  const transitiveRefs = resolveTransitiveDependents(modifiedRefs, allObjects, dependencies);

  // Combine all package objects (modified + transitive)
  const allPackageRefs = [...modifiedObjRefs, ...transitiveRefs];
  const packageRefSet = new Set(allPackageRefs.map(refKey));

  // Deduplicate
  const uniqueRefs: SiebelObjectRef[] = [];
  const seen = new Set<string>();
  for (const ref of allPackageRefs) {
    const key = refKey(ref);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRefs.push(ref);
    }
  }

  // AC3: Sort by deploy order
  const deployOrder = sortByDeployOrder(uniqueRefs);

  // AC5: Lock conflicts
  const conflicts = detectLockConflicts(allObjects, packageRefSet, currentUser);

  // Circular deps
  const circularDeps = detectCircularDeps(packageRefSet, dependencies);

  // Risk level
  const riskLevel = calculateRisk(uniqueRefs.length, conflicts.length, circularDeps.length);

  // AC6: Deploy scripts
  const deployScripts = generateDeployScripts(deployOrder, environments);

  // AC4: Report
  const report = generateReport({
    objects: uniqueRefs,
    deployOrder,
    conflicts,
    circularDeps,
    riskLevel,
    modifiedCount: modifiedObjects.length,
    transitiveCount: transitiveRefs.length,
  });

  logger.info("migration-package: complete", {
    objects: uniqueRefs.length,
    conflicts: conflicts.length,
    riskLevel,
  });

  return {
    objects: uniqueRefs,
    deployOrder,
    conflicts,
    circularDeps,
    deployScripts,
    riskLevel,
    report,
  };
}
