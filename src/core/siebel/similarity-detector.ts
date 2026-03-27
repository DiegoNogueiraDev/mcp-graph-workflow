/**
 * Similarity Detector — identifies duplicate/similar Siebel objects using Jaccard similarity.
 */

import type { SiebelObject, SiebelObjectRef } from "../../schemas/siebel.schema.js";

export interface SimilarityPair {
  a: SiebelObjectRef;
  b: SiebelObjectRef;
  score: number;
  sharedChildren: string[];
}

export interface SimilarityResult {
  pairs: SimilarityPair[];
  threshold: number;
}

/**
 * Detect similar objects by comparing children names and property values.
 * Only compares objects of the same type.
 */
export function detectSimilarObjects(
  objects: SiebelObject[],
  threshold: number = 50,
): SimilarityResult {
  const topLevel = objects.filter((o) => !o.parentName);
  const pairs: SimilarityPair[] = [];

  // Group by type
  const byType = new Map<string, SiebelObject[]>();
  for (const obj of topLevel) {
    const group = byType.get(obj.type) ?? [];
    group.push(obj);
    byType.set(obj.type, group);
  }

  // Compare within each type group
  for (const [, group] of byType) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const { score, sharedChildren } = computeSimilarity(a, b);

        if (score >= threshold) {
          pairs.push({
            a: { name: a.name, type: a.type },
            b: { name: b.name, type: b.type },
            score,
            sharedChildren,
          });
        }
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  return { pairs, threshold };
}

function computeSimilarity(
  a: SiebelObject,
  b: SiebelObject,
): { score: number; sharedChildren: string[] } {
  // Combine children names and key property values into feature sets
  const setA = buildFeatureSet(a);
  const setB = buildFeatureSet(b);

  if (setA.size === 0 && setB.size === 0) {
    // Both empty — check if same key properties
    const propsMatch = hasSameKeyProperties(a, b);
    return { score: propsMatch ? 100 : 0, sharedChildren: [] };
  }

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  const jaccard = union.size > 0 ? intersection.size / union.size : 0;
  const score = Math.round(jaccard * 100);

  // Shared children names specifically
  const childNamesA = new Set(a.children.map((c) => c.name));
  const childNamesB = new Set(b.children.map((c) => c.name));
  const sharedChildren = [...childNamesA].filter((n) => childNamesB.has(n));

  return { score, sharedChildren };
}

function buildFeatureSet(obj: SiebelObject): Set<string> {
  const features = new Set<string>();

  // Children names as features
  for (const child of obj.children) {
    features.add(`child:${child.name}`);
  }

  // Key properties as features
  for (const prop of obj.properties) {
    if (isKeyProperty(prop.name)) {
      features.add(`prop:${prop.name}=${prop.value}`);
    }
  }

  return features;
}

function isKeyProperty(name: string): boolean {
  const keys = new Set(["BUS_COMP", "TABLE", "CLASS", "BUS_OBJECT", "TYPE"]);
  return keys.has(name);
}

function hasSameKeyProperties(a: SiebelObject, b: SiebelObject): boolean {
  const keyPropsA = a.properties.filter((p) => isKeyProperty(p.name));
  const keyPropsB = b.properties.filter((p) => isKeyProperty(p.name));

  if (keyPropsA.length === 0 && keyPropsB.length === 0) return false;

  return keyPropsA.every((pa) =>
    keyPropsB.some((pb) => pb.name === pa.name && pb.value === pa.value)
  );
}
