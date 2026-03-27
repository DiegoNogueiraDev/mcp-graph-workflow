/**
 * Clone & Adapt — deep clone a Siebel object and adapt it with renames, field changes, and script updates.
 *
 * Uses sif-diff.ts to generate a structural diff between original and cloned object.
 */

import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";
import { diffSifObjects, type SifDiffResult } from "./sif-diff.js";
import { logger } from "../utils/logger.js";

// --- Types ---

export interface CloneAdaptRequest {
  readonly source: SiebelObject;
  readonly newName: string;
  readonly renames: Readonly<Record<string, string>>;
  readonly addChildren?: readonly SiebelObject[];
  readonly removeChildren?: readonly string[];
}

export interface CloneAdaptResult {
  readonly cloned: SiebelObject;
  readonly diff: SifDiffResult;
  readonly renamesApplied: number;
}

// --- Deep clone ---

function deepCloneObject(obj: SiebelObject): SiebelObject {
  return {
    name: obj.name,
    type: obj.type,
    project: obj.project,
    properties: obj.properties.map((p) => ({ name: p.name, value: p.value })),
    children: obj.children.map(deepCloneObject),
    parentName: obj.parentName,
    inactive: obj.inactive,
  };
}

// --- Rename logic ---

function applyRenames(value: string, renames: Readonly<Record<string, string>>): string {
  let result = value;
  for (const [from, to] of Object.entries(renames)) {
    // Use global replace to catch all occurrences
    result = replaceAll(result, from, to);
  }
  return result;
}

function replaceAll(str: string, search: string, replacement: string): string {
  if (search.length === 0) return str;
  let result = str;
  let idx = result.indexOf(search);
  while (idx !== -1) {
    result = result.slice(0, idx) + replacement + result.slice(idx + search.length);
    idx = result.indexOf(search, idx + replacement.length);
  }
  return result;
}

function renameObjectTree(
  obj: SiebelObject,
  newName: string,
  oldName: string,
  renames: Readonly<Record<string, string>>,
): { object: SiebelObject; renamesApplied: number } {
  let renamesApplied = 0;

  // Build full rename map including the object name itself
  const fullRenames: Record<string, string> = { ...renames };
  if (oldName !== newName) {
    fullRenames[oldName] = newName;
  }

  // Rename root object
  const renamedProperties = obj.properties.map((p) => {
    const newValue = applyRenames(p.value, fullRenames);
    if (newValue !== p.value) renamesApplied++;
    return { name: p.name, value: newValue };
  });

  // Rename children recursively
  const renamedChildren = obj.children.map((child) => {
    const newParentName = newName;
    const renamedChild = renameChild(child, newParentName, fullRenames);
    renamesApplied += renamedChild.renamesApplied;
    return renamedChild.object;
  });

  return {
    object: {
      name: newName,
      type: obj.type,
      project: obj.project,
      properties: renamedProperties,
      children: renamedChildren,
      parentName: obj.parentName ? applyRenames(obj.parentName, fullRenames) : undefined,
      inactive: obj.inactive,
    },
    renamesApplied,
  };
}

function renameChild(
  child: SiebelObject,
  newParentName: string,
  renames: Readonly<Record<string, string>>,
): { object: SiebelObject; renamesApplied: number } {
  let renamesApplied = 0;

  // Rename properties (including SCRIPT content)
  const renamedProperties = child.properties.map((p) => {
    const newValue = applyRenames(p.value, renames);
    if (newValue !== p.value) renamesApplied++;
    return { name: p.name, value: newValue };
  });

  // Rename child name if it contains old names
  let newChildName = child.name;
  for (const [from, to] of Object.entries(renames)) {
    if (newChildName.includes(from)) {
      newChildName = replaceAll(newChildName, from, to);
      renamesApplied++;
    }
  }

  // Recursive for nested children
  const renamedChildren = child.children.map((c) => {
    const result = renameChild(c, newChildName, renames);
    renamesApplied += result.renamesApplied;
    return result.object;
  });

  return {
    object: {
      name: newChildName,
      type: child.type,
      project: child.project,
      properties: renamedProperties,
      children: renamedChildren,
      parentName: newParentName,
      inactive: child.inactive,
    },
    renamesApplied,
  };
}

// --- Main function ---

export function cloneAndAdapt(request: CloneAdaptRequest): CloneAdaptResult {
  const { source, newName, renames, addChildren, removeChildren } = request;

  logger.info("clone-adapt", {
    source: source.name,
    newName,
    renameCount: String(Object.keys(renames).length),
  });

  // 1. Deep clone the source
  const cloned = deepCloneObject(source);

  // 2. Apply renames throughout the tree
  const renamed = renameObjectTree(cloned, newName, source.name, renames);
  let result = renamed.object;

  // 3. Remove specified children
  if (removeChildren && removeChildren.length > 0) {
    const removeSet = new Set(removeChildren);
    result = {
      ...result,
      children: result.children.filter((c) => !removeSet.has(c.name)),
    };
  }

  // 4. Add new children
  if (addChildren && addChildren.length > 0) {
    const newChildren = addChildren.map((c) => ({
      ...deepCloneObject(c),
      parentName: newName,
    }));
    result = {
      ...result,
      children: [...result.children, ...newChildren],
    };
  }

  // 5. Generate diff between original and clone
  const diff = diffSifObjects([source], [result]);

  logger.info("clone-adapt:complete", {
    childCount: String(result.children.length),
    renamesApplied: String(renamed.renamesApplied),
    diffAdded: String(diff.summary.addedCount),
    diffRemoved: String(diff.summary.removedCount),
    diffModified: String(diff.summary.modifiedCount),
  });

  return {
    cloned: result,
    diff,
    renamesApplied: renamed.renamesApplied,
  };
}
