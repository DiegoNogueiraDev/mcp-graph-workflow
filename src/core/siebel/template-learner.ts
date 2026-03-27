/**
 * Template Learner — learns SIF templates from real Siebel objects.
 *
 * Instead of using hardcoded generic templates, this module analyzes
 * a repository of real SIF objects to learn common patterns per object
 * type + subtype (CLASS), including properties, children structure, and
 * property values.
 */

import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Types ---

export interface LearnedProperty {
  readonly name: string;
  readonly frequency: number; // 0-1, how often this property appears
  readonly commonValues: string[]; // most common values seen
}

export interface LearnedTemplate {
  readonly objectType: SiebelObjectType;
  readonly subType: string; // CLASS value or "default"
  readonly sampleCount: number;
  readonly commonProperties: readonly LearnedProperty[];
  readonly commonChildTypes: readonly SiebelObjectType[];
  readonly avgChildCount: number;
  readonly computeAdherence: (obj: SiebelObject) => number;
}

// --- Internal helpers ---

interface PropertyAccumulator {
  count: number;
  values: Map<string, number>;
}

interface TemplateAccumulator {
  objectType: SiebelObjectType;
  subType: string;
  objects: SiebelObject[];
  properties: Map<string, PropertyAccumulator>;
  childTypeCounts: Map<SiebelObjectType, number>;
  totalChildCount: number;
}

function getSubType(obj: SiebelObject): string {
  const cls = obj.properties.find((p) => p.name === "CLASS")?.value;
  return cls ?? "default";
}

function buildKey(type: SiebelObjectType, subType: string): string {
  return `${type}::${subType}`;
}

function topValues(values: Map<string, number>, max: number): string[] {
  return Array.from(values.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([v]) => v);
}

// --- Main function ---

export function learnTemplates(objects: readonly SiebelObject[]): LearnedTemplate[] {
  // Only consider top-level objects (not children)
  const topLevel = objects.filter((o) => !o.parentName);

  if (topLevel.length === 0) {
    return [];
  }

  // Group by type + subType
  const accumulators = new Map<string, TemplateAccumulator>();

  for (const obj of topLevel) {
    const subType = getSubType(obj);
    const key = buildKey(obj.type, subType);

    let acc = accumulators.get(key);
    if (!acc) {
      acc = {
        objectType: obj.type,
        subType,
        objects: [],
        properties: new Map(),
        childTypeCounts: new Map(),
        totalChildCount: 0,
      };
      accumulators.set(key, acc);
    }

    acc.objects.push(obj);

    // Accumulate properties
    for (const prop of obj.properties) {
      let propAcc = acc.properties.get(prop.name);
      if (!propAcc) {
        propAcc = { count: 0, values: new Map() };
        acc.properties.set(prop.name, propAcc);
      }
      propAcc.count++;
      if (prop.value) {
        propAcc.values.set(prop.value, (propAcc.values.get(prop.value) ?? 0) + 1);
      }
    }

    // Accumulate child type distribution
    acc.totalChildCount += obj.children.length;
    for (const child of obj.children) {
      acc.childTypeCounts.set(
        child.type,
        (acc.childTypeCounts.get(child.type) ?? 0) + 1,
      );
    }
  }

  // Convert accumulators to LearnedTemplates
  const templates: LearnedTemplate[] = [];

  for (const acc of accumulators.values()) {
    const sampleCount = acc.objects.length;

    // Build common properties (present in >= 50% of samples)
    const commonProperties: LearnedProperty[] = [];
    for (const [propName, propAcc] of acc.properties) {
      const frequency = propAcc.count / sampleCount;
      if (frequency >= 0.5) {
        commonProperties.push({
          name: propName,
          frequency,
          commonValues: topValues(propAcc.values, 5),
        });
      }
    }
    commonProperties.sort((a, b) => b.frequency - a.frequency);

    // Build common child types (present in >= 50% of samples)
    const commonChildTypes: SiebelObjectType[] = [];
    for (const [childType, count] of acc.childTypeCounts) {
      if (count / sampleCount >= 0.5) {
        commonChildTypes.push(childType);
      }
    }

    const avgChildCount = sampleCount > 0
      ? Math.round((acc.totalChildCount / sampleCount) * 100) / 100
      : 0;

    // Closure for adherence scoring
    const computeAdherence = (obj: SiebelObject): number => {
      return calculateTemplateAdherence(obj, commonProperties, sampleCount);
    };

    templates.push({
      objectType: acc.objectType,
      subType: acc.subType,
      sampleCount,
      commonProperties,
      commonChildTypes,
      avgChildCount,
      computeAdherence,
    });
  }

  logger.debug("template-learner", {
    inputObjects: topLevel.length,
    templatesLearned: templates.length,
  });

  return templates;
}

function calculateTemplateAdherence(
  obj: SiebelObject,
  commonProperties: readonly LearnedProperty[],
  _sampleCount: number,
): number {
  if (commonProperties.length === 0) return 50; // neutral

  const objPropNames = new Set(obj.properties.map((p) => p.name));
  let matched = 0;
  let weighted = 0;

  for (const cp of commonProperties) {
    weighted += cp.frequency;
    if (objPropNames.has(cp.name)) {
      matched += cp.frequency;
    }
  }

  if (weighted === 0) return 50;
  return Math.round((matched / weighted) * 100);
}
