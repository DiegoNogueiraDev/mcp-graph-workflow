/**
 * Code Review Automatizado para SIFs — reviews Siebel objects before deploy
 * checking patterns, anti-patterns, naming, scripts, and compliance.
 *
 * Categories: naming, error_handling, hardcoded_values, field_reference,
 * profile_attr, test_objects
 */

import type { SiebelObject } from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Public types ---

export type ReviewCategory =
  | "naming"
  | "error_handling"
  | "hardcoded_values"
  | "field_reference"
  | "profile_attr"
  | "test_objects";

export interface ReviewIssue {
  readonly category: ReviewCategory;
  readonly severity: "error" | "warning" | "info";
  readonly objectName: string;
  readonly detail: string;
  readonly suggestion: string;
}

export interface ReviewOptions {
  readonly prefix: string;
  readonly allowedPrefixes?: readonly string[];
}

export interface ScoreBreakdown {
  readonly naming: number;
  readonly error_handling: number;
  readonly hardcoded_values: number;
  readonly field_reference: number;
  readonly profile_attr: number;
  readonly test_objects: number;
}

export interface CodeReviewResult {
  readonly issues: readonly ReviewIssue[];
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
  readonly objectCount: number;
}

// --- Helpers ---

function getAllScripts(objects: readonly SiebelObject[]): Array<{ parent: string; name: string; code: string }> {
  const scripts: Array<{ parent: string; name: string; code: string }> = [];
  for (const obj of objects) {
    for (const child of obj.children) {
      if (child.type === "escript") {
        const code = child.properties.find((p) => p.name === "SOURCE_CODE")?.value ?? "";
        if (code.trim()) {
          scripts.push({ parent: obj.name, name: child.name, code });
        }
      }
    }
  }
  return scripts;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Checks ---

/** AC1: Naming convention check */
function checkNaming(objects: readonly SiebelObject[], opts: ReviewOptions): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const prefixes = opts.allowedPrefixes ?? [opts.prefix];
  const checkTypes = new Set(["applet", "business_component", "business_object", "view", "screen", "business_service", "integration_object", "workflow"]);

  for (const obj of objects) {
    if (!checkTypes.has(obj.type)) continue;
    const hasPrefix = prefixes.some((p) => obj.name.startsWith(p));
    if (!hasPrefix) {
      issues.push({
        category: "naming",
        severity: "warning",
        objectName: obj.name,
        detail: `Object "${obj.name}" does not start with required prefix (${prefixes.join(", ")})`,
        suggestion: `Rename to "${prefixes[0]}${obj.name}" or use an allowed prefix`,
      });
    }
  }

  return issues;
}

/** AC2: Error handling check */
function checkErrorHandling(objects: readonly SiebelObject[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const scripts = getAllScripts(objects);

  for (const s of scripts) {
    const hasFunction = /function\s+\w+/.test(s.code);
    const hasTry = /\btry\s*\{/.test(s.code);
    if (hasFunction && !hasTry) {
      issues.push({
        category: "error_handling",
        severity: "error",
        objectName: s.parent,
        detail: `Script "${s.name}" has no try/catch error handling`,
        suggestion: "Wrap function body in try/catch/finally with TheApplication().RaiseErrorText()",
      });
    }
  }

  return issues;
}

/** AC3: Hardcoded values */
function checkHardcodedValues(objects: readonly SiebelObject[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const scripts = getAllScripts(objects);

  const patterns: Array<{ name: string; regex: RegExp; suggestion: string }> = [
    { name: "URL", regex: /https?:\/\/[^\s"']+/, suggestion: "Use a system preference or profile attribute for URLs" },
    { name: "IP address", regex: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, suggestion: "Use a system preference for IP addresses" },
    { name: "environment name", regex: /\b(?:PROD|STAGING|DEV|TEST|UAT)_\w*(?:SERVER|HOST|ENV)\w*/i, suggestion: "Use TheApplication().GetProfileAttr() for environment-specific values" },
  ];

  for (const s of scripts) {
    for (const p of patterns) {
      if (p.regex.test(s.code)) {
        issues.push({
          category: "hardcoded_values",
          severity: "warning",
          objectName: s.parent,
          detail: `Script "${s.name}" contains hardcoded ${p.name}`,
          suggestion: p.suggestion,
        });
      }
    }
  }

  return issues;
}

/** AC4: Field reference validation */
function checkFieldReferences(objects: readonly SiebelObject[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  // Build field index: BC name → Set of field names
  const bcFields = new Map<string, Set<string>>();
  for (const obj of objects) {
    if (obj.type === "business_component") {
      const fields = new Set(obj.children.filter((c) => c.type === "field").map((c) => c.name));
      bcFields.set(obj.name, fields);
    }
  }

  if (bcFields.size === 0) return issues;

  const scripts = getAllScripts(objects);
  for (const s of scripts) {
    const getFieldPattern = /GetFieldValue\s*\(\s*"([^"]+)"\s*\)/g;
    let match;
    while ((match = getFieldPattern.exec(s.code)) !== null) {
      const fieldName = match[1];
      // Check if any known BC has this field
      let found = false;
      for (const fields of bcFields.values()) {
        if (fields.has(fieldName)) {
          found = true;
          break;
        }
      }
      if (!found) {
        issues.push({
          category: "field_reference",
          severity: "warning",
          objectName: s.parent,
          detail: `Script "${s.name}" references field "${fieldName}" not found in any BC`,
          suggestion: `Verify field "${fieldName}" exists in the target BC or add it`,
        });
      }
    }
  }

  return issues;
}

/** AC5: ProfileAttr tracking */
function checkProfileAttrs(objects: readonly SiebelObject[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const scripts = getAllScripts(objects);

  const setAttrs = new Set<string>();
  const getAttrs = new Set<string>();

  for (const s of scripts) {
    const setPattern = /SetProfileAttr\s*\(\s*"([^"]+)"/g;
    const getPattern = /GetProfileAttr\s*\(\s*"([^"]+)"/g;
    let match;

    while ((match = setPattern.exec(s.code)) !== null) {
      setAttrs.add(match[1]);
    }
    while ((match = getPattern.exec(s.code)) !== null) {
      getAttrs.add(match[1]);
    }
  }

  // Find orphan Set (set but never consumed)
  for (const attr of setAttrs) {
    if (!getAttrs.has(attr)) {
      issues.push({
        category: "profile_attr",
        severity: "info",
        objectName: "global",
        detail: `ProfileAttr "${attr}" is set but never consumed by GetProfileAttr`,
        suggestion: `Verify "${attr}" is consumed in other scripts not included in this review, or remove the SetProfileAttr`,
      });
    }
  }

  return issues;
}

/** AC6: Test objects check */
function checkTestObjects(objects: readonly SiebelObject[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const testPattern = /(?:^|[\s_])(?:Test|Debug|Temp|Temporary|TODO)(?:[\s_]|$)/i;

  for (const obj of objects) {
    if (obj.inactive) continue;
    if (testPattern.test(obj.name)) {
      issues.push({
        category: "test_objects",
        severity: "warning",
        objectName: obj.name,
        detail: `Object "${obj.name}" appears to be a test/debug object but is active (INACTIVE=N)`,
        suggestion: `Set INACTIVE="Y" or remove if no longer needed`,
      });
    }
  }

  return issues;
}

// --- Score calculation ---

function calculateScore(issues: readonly ReviewIssue[], objectCount: number): { score: number; breakdown: ScoreBreakdown } {
  if (objectCount === 0) {
    return {
      score: 100,
      breakdown: { naming: 100, error_handling: 100, hardcoded_values: 100, field_reference: 100, profile_attr: 100, test_objects: 100 },
    };
  }

  const weights: Record<ReviewCategory, { weight: number; penalty: Record<string, number> }> = {
    naming: { weight: 20, penalty: { error: 20, warning: 10, info: 5 } },
    error_handling: { weight: 25, penalty: { error: 25, warning: 15, info: 5 } },
    hardcoded_values: { weight: 15, penalty: { error: 15, warning: 8, info: 3 } },
    field_reference: { weight: 15, penalty: { error: 15, warning: 8, info: 3 } },
    profile_attr: { weight: 10, penalty: { error: 10, warning: 5, info: 2 } },
    test_objects: { weight: 15, penalty: { error: 15, warning: 8, info: 3 } },
  };

  const breakdown: Record<string, number> = {};
  let totalScore = 0;

  for (const [cat, config] of Object.entries(weights)) {
    const catIssues = issues.filter((i) => i.category === cat);
    let catDeduction = 0;
    for (const issue of catIssues) {
      catDeduction += config.penalty[issue.severity] ?? 0;
    }
    const catScore = Math.max(0, 100 - catDeduction);
    breakdown[cat] = catScore;
    totalScore += catScore * (config.weight / 100);
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, totalScore))),
    breakdown: breakdown as unknown as ScoreBreakdown,
  };
}

// --- Main function ---

export function reviewSiebelCode(
  objects: readonly SiebelObject[],
  options: ReviewOptions,
): CodeReviewResult {
  logger.debug("code-review: starting review", { objectCount: objects.length, prefix: options.prefix });

  const allIssues: ReviewIssue[] = [
    ...checkNaming(objects, options),
    ...checkErrorHandling(objects),
    ...checkHardcodedValues(objects),
    ...checkFieldReferences(objects),
    ...checkProfileAttrs(objects),
    ...checkTestObjects(objects),
  ];

  const { score, breakdown } = calculateScore(allIssues, objects.length);

  logger.info("code-review: complete", {
    objectCount: objects.length,
    issues: allIssues.length,
    score,
  });

  return {
    issues: allIssues,
    score,
    breakdown,
    objectCount: objects.length,
  };
}
