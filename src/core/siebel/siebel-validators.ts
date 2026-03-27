/**
 * Siebel Validators — security, performance, and migration readiness validation.
 *
 * Tasks 10.2, 10.3, 10.4 of Epic 10: Validação Avançada e Compliance.
 */

import type { SiebelObject, SiebelObjectType, SiebelDependency } from "../../schemas/siebel.schema.js";
import { detectCircularDeps } from "./dependency-analyzer.js";
import { logger } from "../utils/logger.js";

// ============================================================
// 10.2 — Security Validation
// ============================================================

const SENSITIVE_FIELD_PATTERNS = [
  /cpf/i, /cnpj/i, /credit.?card/i, /cartao/i, /ssn/i,
  /password/i, /senha/i, /token/i, /secret/i,
];

const PERSONAL_FIELD_PATTERNS = [
  /email/i, /phone/i, /telefone/i, /celular/i, /mobile/i,
  /address/i, /endereco/i, /birth/i, /nascimento/i,
  /cpf/i, /cnpj/i, /rg\b/i,
];

export interface SensitiveFieldHit {
  readonly bcName: string;
  readonly fieldName: string;
  readonly columnName: string;
  readonly reason: string;
}

export interface DangerousOperation {
  readonly objectName: string;
  readonly objectType: SiebelObjectType;
  readonly operation: string;
  readonly reason: string;
}

export interface VisibilityIssue {
  readonly objectName: string;
  readonly objectType: SiebelObjectType;
  readonly issue: string;
}

export interface LgpdReport {
  readonly personalFieldsExposed: number;
  readonly fields: readonly { bcName: string; fieldName: string }[];
}

export interface SecurityValidationResult {
  readonly status: "valid" | "warnings" | "invalid";
  readonly sensitiveFields: readonly SensitiveFieldHit[];
  readonly dangerousOperations: readonly DangerousOperation[];
  readonly visibilityIssues: readonly VisibilityIssue[];
  readonly lgpdReport: LgpdReport;
}

export function validateSecurity(objects: readonly SiebelObject[]): SecurityValidationResult {
  const sensitiveFields: SensitiveFieldHit[] = [];
  const dangerousOperations: DangerousOperation[] = [];
  const visibilityIssues: VisibilityIssue[] = [];
  const personalFields: { bcName: string; fieldName: string }[] = [];

  for (const obj of objects) {
    // AC1: Sensitive fields in BCs
    if (obj.type === "business_component") {
      for (const child of obj.children) {
        if (child.type === "field") {
          const col = child.properties.find((p) => p.name === "COLUMN")?.value ?? "";
          for (const pattern of SENSITIVE_FIELD_PATTERNS) {
            if (pattern.test(child.name) || pattern.test(col)) {
              sensitiveFields.push({
                bcName: obj.name,
                fieldName: child.name,
                columnName: col,
                reason: `Matches sensitive pattern: ${pattern.source}`,
              });
              break;
            }
          }
          // LGPD personal fields
          for (const pattern of PERSONAL_FIELD_PATTERNS) {
            if (pattern.test(child.name) || pattern.test(col)) {
              personalFields.push({ bcName: obj.name, fieldName: child.name });
              break;
            }
          }
        }
      }
    }

    // AC2: Dangerous delete operations
    if (obj.type === "applet") {
      for (const child of obj.children) {
        const method = child.properties.find((p) => p.name === "METHOD_INVOKED")?.value;
        if (method === "DeleteRecord") {
          dangerousOperations.push({
            objectName: obj.name,
            objectType: obj.type,
            operation: "DeleteRecord",
            reason: "Applet exposes DeleteRecord method",
          });
        }
      }
    }

    // AC3: Visibility rules
    if (obj.type === "view" || obj.type === "applet") {
      const hasVisibility = obj.properties.some(
        (p) => p.name === "VISIBILITY_TYPE" || p.name === "VISIBILITY_APPLET_TYPE",
      );
      if (!hasVisibility) {
        visibilityIssues.push({
          objectName: obj.name,
          objectType: obj.type,
          issue: "No VISIBILITY_TYPE defined — may expose data to unauthorized users",
        });
      }
    }
  }

  const hasIssues = sensitiveFields.length > 0 || dangerousOperations.length > 0 || visibilityIssues.length > 0;
  const status = sensitiveFields.length > 0 ? "invalid" as const : hasIssues ? "warnings" as const : "valid" as const;

  logger.debug("validate-security", {
    sensitiveFields: String(sensitiveFields.length),
    dangerousOps: String(dangerousOperations.length),
    visibilityIssues: String(visibilityIssues.length),
    personalFields: String(personalFields.length),
  });

  return {
    status,
    sensitiveFields,
    dangerousOperations,
    visibilityIssues,
    lgpdReport: {
      personalFieldsExposed: personalFields.length,
      fields: personalFields,
    },
  };
}

// ============================================================
// 10.3 — Performance Validation
// ============================================================

export interface PerformanceIssue {
  readonly objectName: string;
  readonly objectType: SiebelObjectType;
  readonly rule: string;
  readonly severity: "warning" | "error";
  readonly detail: string;
}

export interface PerformanceValidationResult {
  readonly status: "valid" | "warnings" | "invalid";
  readonly issues: readonly PerformanceIssue[];
}

const INFINITE_LOOP_PATTERNS = [
  /while\s*\(\s*true\s*\)/i,
  /while\s*\(\s*1\s*\)/i,
  /for\s*\(\s*;\s*;\s*\)/i,
];

export function validatePerformance(objects: readonly SiebelObject[]): PerformanceValidationResult {
  const issues: PerformanceIssue[] = [];

  for (const obj of objects) {
    // AC1: Excessive fields in BCs
    if (obj.type === "business_component") {
      const fieldCount = obj.children.filter((c) => c.type === "field").length;
      if (fieldCount > 100) {
        issues.push({
          objectName: obj.name, objectType: obj.type,
          rule: "excessive_fields", severity: "error",
          detail: `BC has ${fieldCount} fields (>100 limit)`,
        });
      } else if (fieldCount > 50) {
        issues.push({
          objectName: obj.name, objectType: obj.type,
          rule: "excessive_fields", severity: "warning",
          detail: `BC has ${fieldCount} fields (>50 threshold)`,
        });
      }

      // AC2: Missing search/sort spec
      const hasSearchSpec = obj.properties.some((p) => p.name === "SEARCH_SPEC");
      const hasSortSpec = obj.properties.some((p) => p.name === "SORT_SPEC");
      if (!hasSearchSpec && !hasSortSpec) {
        issues.push({
          objectName: obj.name, objectType: obj.type,
          rule: "missing_search_spec", severity: "warning",
          detail: "BC has no SEARCH_SPEC or SORT_SPEC — may cause full table scans",
        });
      }
    }

    // AC3: Views with too many applets
    if (obj.type === "view") {
      const appletCount = obj.children.filter((c) => c.type === "applet").length;
      if (appletCount > 5) {
        issues.push({
          objectName: obj.name, objectType: obj.type,
          rule: "excessive_applets", severity: "warning",
          detail: `View has ${appletCount} applets (>5 threshold)`,
        });
      }
    }

    // AC4: Links without constraints (check link children)
    if (obj.type === "link") {
      const hasConstraint = obj.properties.some(
        (p) => p.name === "SOURCE_FIELD" || p.name === "DESTINATION_FIELD",
      );
      if (!hasConstraint) {
        issues.push({
          objectName: obj.name, objectType: obj.type,
          rule: "unconstrained_link", severity: "warning",
          detail: "Link has no relationship constraints",
        });
      }
    }

    // AC5: Infinite loop detection in scripts
    if (obj.type === "escript") {
      const script = obj.properties.find((p) => p.name === "SCRIPT")?.value ?? "";
      for (const pattern of INFINITE_LOOP_PATTERNS) {
        if (pattern.test(script)) {
          issues.push({
            objectName: obj.name, objectType: obj.type,
            rule: "potential_infinite_loop", severity: "error",
            detail: `Script contains potential infinite loop pattern: ${pattern.source}`,
          });
          break;
        }
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  const status = hasErrors ? "invalid" as const : issues.length > 0 ? "warnings" as const : "valid" as const;

  logger.debug("validate-performance", { issueCount: String(issues.length), status });

  return { status, issues };
}

// ============================================================
// 10.4 — Migration Readiness Validation
// ============================================================

export interface MigrationChecklistItem {
  readonly check: string;
  readonly status: "green" | "yellow" | "red";
  readonly detail: string;
}

export interface HardcodedValue {
  readonly objectName: string;
  readonly pattern: string;
  readonly snippet: string;
}

export interface MigrationReadinessResult {
  readonly status: "valid" | "warnings" | "invalid";
  readonly unresolvedDeps: readonly { from: string; to: string; toType: string }[];
  readonly hasCycles: boolean;
  readonly hardcodedValues: readonly HardcodedValue[];
  readonly checklist: readonly MigrationChecklistItem[];
}

const HARDCODED_PATTERNS = [
  /https?:\/\/[a-zA-Z0-9.-]+\.(com|net|org|io|internal|local)/i,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP addresses
  /jdbc:[a-zA-Z]+:\/\//i,
  /server\s*=\s*["'][^"']+["']/i,
  /host\s*=\s*["'][^"']+["']/i,
];

export function validateMigrationReadiness(
  objects: readonly SiebelObject[],
  dependencies: readonly SiebelDependency[],
): MigrationReadinessResult {
  // AC1: Check unresolved dependencies
  const objectIndex = new Set(objects.map((o) => `${o.type}::${o.name}`));
  const unresolvedDeps: { from: string; to: string; toType: string }[] = [];

  for (const dep of dependencies) {
    const toKey = `${dep.to.type}::${dep.to.name}`;
    if (!objectIndex.has(toKey)) {
      unresolvedDeps.push({ from: dep.from.name, to: dep.to.name, toType: dep.to.type });
    }
  }

  // AC2: Circular dependencies
  const cycles = detectCircularDeps([...dependencies]);
  const hasCycles = cycles.length > 0;

  // AC3: Best practices — delegated to existing validateBestPractices in siebel-validate.ts
  // We check basic structural validity here
  const bestPracticeIssues: string[] = [];
  for (const obj of objects) {
    if (obj.type === "business_component" && !obj.properties.some((p) => p.name === "TABLE")) {
      bestPracticeIssues.push(`BC "${obj.name}" missing TABLE`);
    }
    if (obj.type === "applet" && !obj.properties.some((p) => p.name === "BUS_COMP")) {
      bestPracticeIssues.push(`Applet "${obj.name}" missing BUS_COMP`);
    }
  }

  // AC4: Hardcoded environment values
  const hardcodedValues: HardcodedValue[] = [];
  for (const obj of objects) {
    for (const prop of obj.properties) {
      if (prop.name === "SCRIPT" || prop.name === "VALUE") {
        for (const pattern of HARDCODED_PATTERNS) {
          const match = prop.value.match(pattern);
          if (match) {
            hardcodedValues.push({
              objectName: obj.name,
              pattern: pattern.source,
              snippet: match[0].slice(0, 80),
            });
          }
        }
      }
    }
  }

  // AC5: Build checklist
  const checklist: MigrationChecklistItem[] = [
    {
      check: "dependencies_resolved",
      status: unresolvedDeps.length === 0 ? "green" : "red",
      detail: unresolvedDeps.length === 0
        ? "All dependencies resolved"
        : `${unresolvedDeps.length} unresolved dependencies`,
    },
    {
      check: "no_circular_deps",
      status: hasCycles ? "red" : "green",
      detail: hasCycles ? `${cycles.length} circular dependencies found` : "No circular dependencies",
    },
    {
      check: "best_practices",
      status: bestPracticeIssues.length === 0 ? "green" : "yellow",
      detail: bestPracticeIssues.length === 0
        ? "All objects pass best practice checks"
        : `${bestPracticeIssues.length} best practice issues`,
    },
    {
      check: "no_hardcoded_values",
      status: hardcodedValues.length === 0 ? "green" : "yellow",
      detail: hardcodedValues.length === 0
        ? "No hardcoded environment values detected"
        : `${hardcodedValues.length} hardcoded values found in scripts`,
    },
    {
      check: "object_count",
      status: objects.length > 0 ? "green" : "yellow",
      detail: `${objects.length} objects ready for migration`,
    },
  ];

  const hasRed = checklist.some((c) => c.status === "red");
  const hasYellow = checklist.some((c) => c.status === "yellow");
  const status = hasRed ? "invalid" as const : hasYellow ? "warnings" as const : "valid" as const;

  logger.debug("validate-migration-readiness", {
    unresolvedDeps: String(unresolvedDeps.length),
    hasCycles: String(hasCycles),
    hardcodedValues: String(hardcodedValues.length),
    status,
  });

  return { status, unresolvedDeps, hasCycles, hardcodedValues, checklist };
}
