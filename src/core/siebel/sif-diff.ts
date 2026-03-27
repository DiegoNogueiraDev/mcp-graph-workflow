/**
 * SIF Diff — structural diff between two sets of Siebel objects.
 *
 * Compares objects by name+type, then diffs their properties and children.
 * Produces both structured JSON and Markdown output.
 */

import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Types ---

export interface PropertyChange {
  readonly name: string;
  readonly changeType: "added" | "removed" | "modified";
  readonly oldValue?: string;
  readonly newValue?: string;
}

export interface ChildChanges {
  readonly added: readonly { name: string; type: SiebelObjectType }[];
  readonly removed: readonly { name: string; type: SiebelObjectType }[];
  readonly modified: readonly { name: string; type: SiebelObjectType; propertyChanges: readonly PropertyChange[] }[];
}

export interface ObjectModification {
  readonly objectName: string;
  readonly objectType: SiebelObjectType;
  readonly propertyChanges: readonly PropertyChange[];
  readonly childChanges: ChildChanges;
}

export interface SifDiffResult {
  readonly added: readonly { name: string; type: SiebelObjectType }[];
  readonly removed: readonly { name: string; type: SiebelObjectType }[];
  readonly modified: readonly ObjectModification[];
  readonly unchanged: number;
  readonly summary: {
    totalBase: number;
    totalTarget: number;
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    unchangedCount: number;
  };
}

// --- Diff Logic ---

function objectKey(obj: { name: string; type: string }): string {
  return `${obj.type}::${obj.name}`;
}

function diffProperties(
  baseProps: readonly { name: string; value: string }[],
  targetProps: readonly { name: string; value: string }[],
): PropertyChange[] {
  const changes: PropertyChange[] = [];
  const baseMap = new Map(baseProps.map((p) => [p.name, p.value]));
  const targetMap = new Map(targetProps.map((p) => [p.name, p.value]));

  // Check for modified and removed
  for (const [name, oldValue] of baseMap) {
    const newValue = targetMap.get(name);
    if (newValue === undefined) {
      changes.push({ name, changeType: "removed", oldValue });
    } else if (newValue !== oldValue) {
      changes.push({ name, changeType: "modified", oldValue, newValue });
    }
  }

  // Check for added
  for (const [name, newValue] of targetMap) {
    if (!baseMap.has(name)) {
      changes.push({ name, changeType: "added", newValue });
    }
  }

  return changes;
}

function diffChildren(
  baseChildren: readonly SiebelObject[],
  targetChildren: readonly SiebelObject[],
): ChildChanges {
  const baseIndex = new Map<string, SiebelObject>();
  for (const child of baseChildren) {
    baseIndex.set(objectKey(child), child);
  }

  const targetIndex = new Map<string, SiebelObject>();
  for (const child of targetChildren) {
    targetIndex.set(objectKey(child), child);
  }

  const added: { name: string; type: SiebelObjectType }[] = [];
  const removed: { name: string; type: SiebelObjectType }[] = [];
  const modified: { name: string; type: SiebelObjectType; propertyChanges: PropertyChange[] }[] = [];

  // Removed children
  for (const [key, child] of baseIndex) {
    if (!targetIndex.has(key)) {
      removed.push({ name: child.name, type: child.type });
    }
  }

  // Added and modified children
  for (const [key, child] of targetIndex) {
    const baseChild = baseIndex.get(key);
    if (!baseChild) {
      added.push({ name: child.name, type: child.type });
    } else {
      const propChanges = diffProperties(baseChild.properties, child.properties);
      if (propChanges.length > 0) {
        modified.push({ name: child.name, type: child.type, propertyChanges: propChanges });
      }
    }
  }

  return { added, removed, modified };
}

export function diffSifObjects(
  baseObjects: readonly SiebelObject[],
  targetObjects: readonly SiebelObject[],
): SifDiffResult {
  const baseIndex = new Map<string, SiebelObject>();
  for (const obj of baseObjects) {
    if (!obj.parentName) {
      baseIndex.set(objectKey(obj), obj);
    }
  }

  const targetIndex = new Map<string, SiebelObject>();
  for (const obj of targetObjects) {
    if (!obj.parentName) {
      targetIndex.set(objectKey(obj), obj);
    }
  }

  const added: { name: string; type: SiebelObjectType }[] = [];
  const removed: { name: string; type: SiebelObjectType }[] = [];
  const modified: ObjectModification[] = [];
  let unchanged = 0;

  // Removed objects
  for (const [key, obj] of baseIndex) {
    if (!targetIndex.has(key)) {
      removed.push({ name: obj.name, type: obj.type });
    }
  }

  // Added and modified objects
  for (const [key, obj] of targetIndex) {
    const baseObj = baseIndex.get(key);
    if (!baseObj) {
      added.push({ name: obj.name, type: obj.type });
    } else {
      const propertyChanges = diffProperties(baseObj.properties, obj.properties);
      const childChanges = diffChildren(baseObj.children, obj.children);

      const hasChanges =
        propertyChanges.length > 0 ||
        childChanges.added.length > 0 ||
        childChanges.removed.length > 0 ||
        childChanges.modified.length > 0;

      if (hasChanges) {
        modified.push({
          objectName: obj.name,
          objectType: obj.type,
          propertyChanges,
          childChanges,
        });
      } else {
        unchanged++;
      }
    }
  }

  const result: SifDiffResult = {
    added,
    removed,
    modified,
    unchanged,
    summary: {
      totalBase: baseIndex.size,
      totalTarget: targetIndex.size,
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      unchangedCount: unchanged,
    },
  };

  logger.debug("sif-diff", {
    added: String(added.length),
    removed: String(removed.length),
    modified: String(modified.length),
    unchanged: String(unchanged),
  });

  return result;
}

// --- Markdown Formatter ---

export function formatDiffMarkdown(diff: SifDiffResult): string {
  const lines: string[] = [];

  lines.push("# SIF Diff Report");
  lines.push("");
  lines.push(`**Base:** ${diff.summary.totalBase} objects | **Target:** ${diff.summary.totalTarget} objects`);
  lines.push(`**Added:** ${diff.summary.addedCount} | **Removed:** ${diff.summary.removedCount} | **Modified:** ${diff.summary.modifiedCount} | **Unchanged:** ${diff.summary.unchangedCount}`);
  lines.push("");

  // Added
  if (diff.added.length > 0) {
    lines.push("## Added Objects");
    for (const obj of diff.added) {
      lines.push(`- **${obj.type}**: \`${obj.name}\``);
    }
    lines.push("");
  }

  // Removed
  if (diff.removed.length > 0) {
    lines.push("## Removed Objects");
    for (const obj of diff.removed) {
      lines.push(`- **${obj.type}**: \`${obj.name}\``);
    }
    lines.push("");
  }

  // Modified
  if (diff.modified.length > 0) {
    lines.push("## Modified Objects");
    for (const mod of diff.modified) {
      lines.push(`### ${mod.objectType}: \`${mod.objectName}\``);

      if (mod.propertyChanges.length > 0) {
        lines.push("**Property Changes:**");
        for (const pc of mod.propertyChanges) {
          switch (pc.changeType) {
            case "added":
              lines.push(`  - (+) \`${pc.name}\` = \`${pc.newValue}\``);
              break;
            case "removed":
              lines.push(`  - (-) \`${pc.name}\` (was \`${pc.oldValue}\`)`);
              break;
            case "modified":
              lines.push(`  - (~) \`${pc.name}\`: \`${pc.oldValue}\` → \`${pc.newValue}\``);
              break;
          }
        }
      }

      const cc = mod.childChanges;
      if (cc.added.length > 0 || cc.removed.length > 0 || cc.modified.length > 0) {
        lines.push("**Child Changes:**");
        for (const c of cc.added) lines.push(`  - (+) ${c.type}: \`${c.name}\``);
        for (const c of cc.removed) lines.push(`  - (-) ${c.type}: \`${c.name}\``);
        for (const c of cc.modified) lines.push(`  - (~) ${c.type}: \`${c.name}\` (${c.propertyChanges.length} property changes)`);
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}
