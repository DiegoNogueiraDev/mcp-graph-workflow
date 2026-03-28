/**
 * Siebel Troubleshooting Assistant — analyzes errors and suggests causes/fixes
 * based on object dependencies, script patterns, and common Siebel issues.
 */

import type {
  SiebelObject,
  SiebelObjectRef,
  SiebelDependency,
} from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Public types ---

export interface TroubleshootRequest {
  readonly errorMessage: string;
  readonly objects: readonly SiebelObject[];
  readonly dependencies: readonly SiebelDependency[];
}

export interface TroubleshootCause {
  readonly description: string;
  readonly probability: number; // 0-1
  readonly category: string;
  readonly suggestion: string;
  readonly codeExample?: string;
}

export interface RelatedScript {
  readonly parentObject: string;
  readonly methodName: string;
  readonly snippet: string;
}

export interface ConfigIssue {
  readonly objectName: string;
  readonly issueType: string;
  readonly detail: string;
}

export interface TroubleshootResult {
  readonly errorMessage: string;
  readonly relatedObjects: readonly SiebelObjectRef[];
  readonly relatedScripts: readonly RelatedScript[];
  readonly dependencyChain: readonly SiebelObjectRef[];
  readonly configIssues: readonly ConfigIssue[];
  readonly causes: readonly TroubleshootCause[];
}

// --- Helpers ---

function extractObjectNames(text: string, objects: readonly SiebelObject[]): SiebelObjectRef[] {
  const found: SiebelObjectRef[] = [];
  const seen = new Set<string>();

  for (const obj of objects) {
    if (text.includes(obj.name) && !seen.has(obj.name)) {
      seen.add(obj.name);
      found.push({ name: obj.name, type: obj.type });
    }
  }

  return found;
}

function findRelatedScripts(
  relatedNames: Set<string>,
  objects: readonly SiebelObject[],
): RelatedScript[] {
  const scripts: RelatedScript[] = [];

  for (const obj of objects) {
    // Check if object itself is related or if its name appears in error
    const isRelated = relatedNames.has(obj.name);

    for (const child of obj.children) {
      if (child.type !== "escript") continue;
      const code = child.properties.find((p) => p.name === "SOURCE_CODE")?.value ?? "";
      if (!code.trim()) continue;

      // Include if parent is related, or script references a related object
      const referencesRelated = [...relatedNames].some((name) => code.includes(name));
      if (isRelated || referencesRelated) {
        scripts.push({
          parentObject: obj.name,
          methodName: child.name,
          snippet: code.substring(0, 200),
        });
      }
    }
  }

  return scripts;
}

function buildDependencyChain(
  relatedRefs: readonly SiebelObjectRef[],
  dependencies: readonly SiebelDependency[],
): SiebelObjectRef[] {
  if (relatedRefs.length === 0 || dependencies.length === 0) return [];

  const _relatedKeys = new Set(relatedRefs.map((r) => `${r.type}:${r.name}`));
  const chain: SiebelObjectRef[] = [];
  const visited = new Set<string>();

  // BFS from related objects through dependency graph
  const queue = [...relatedRefs];
  for (const ref of queue) {
    visited.add(`${ref.type}:${ref.name}`);
  }

  while (queue.length > 0) {
    const current = queue.shift() as SiebelObjectRef;
    const currentKey = `${current.type}:${current.name}`;

    // Find objects that depend on current (reverse deps)
    for (const dep of dependencies) {
      const toKey = `${dep.to.type}:${dep.to.name}`;
      const fromKey = `${dep.from.type}:${dep.from.name}`;

      if (toKey === currentKey && !visited.has(fromKey)) {
        visited.add(fromKey);
        chain.push(dep.from);
        queue.push(dep.from);
      }

      // Also follow forward deps
      if (fromKey === currentKey && !visited.has(toKey)) {
        visited.add(toKey);
        chain.push(dep.to);
        queue.push(dep.to);
      }
    }
  }

  return chain;
}

function checkConfigIssues(
  relatedNames: Set<string>,
  objects: readonly SiebelObject[],
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  for (const obj of objects) {
    if (!relatedNames.has(obj.name)) continue;

    // Check for empty User Properties
    const userProps = obj.children.filter((c) => c.type === "user_property");
    for (const up of userProps) {
      const value = up.properties.find((p) => p.name === "VALUE")?.value;
      if (value !== undefined && value.trim() === "") {
        issues.push({
          objectName: obj.name,
          issueType: "empty_user_property",
          detail: `User Property "${up.name}" has empty value`,
        });
      }
    }

    // Check for missing BUS_COMP in applets
    if (obj.type === "applet") {
      const busComp = obj.properties.find((p) => p.name === "BUS_COMP")?.value;
      if (!busComp) {
        issues.push({
          objectName: obj.name,
          issueType: "missing_bus_comp",
          detail: "Applet has no BUS_COMP property",
        });
      }
    }
  }

  return issues;
}

// --- Cause analysis ---

interface CauseRule {
  pattern: RegExp;
  category: string;
  description: string;
  probability: number;
  suggestion: string;
  codeExample?: string;
}

const CAUSE_RULES: CauseRule[] = [
  {
    pattern: /not set|null|undefined|reference/i,
    category: "null_reference",
    description: "Object reference is null — likely a BusComp or Service not properly initialized",
    probability: 0.85,
    suggestion: "Check if GetBusComp/GetService is called before accessing the object. Ensure the BC/Service name is correct.",
    codeExample: `var bc = TheApplication().GetBusComp("Account");\nif (bc != null) {\n  // safe to use\n}`,
  },
  {
    pattern: /no records|empty|not found|query/i,
    category: "query_issue",
    description: "Query returns no records — possible SearchSpec, ViewMode, or ActivateField issue",
    probability: 0.8,
    suggestion: "Verify SearchSpec syntax, check SetViewMode is correct, ensure ActivateField called before SetSearchSpec.",
    codeExample: `bc.ActivateField("Status");\nbc.SetViewMode(AllView);\nbc.ClearToQuery();\nbc.SetSearchSpec("Status", "Active");\nbc.ExecuteQuery(ForwardOnly);`,
  },
  {
    pattern: /display|render|show|visible|applet/i,
    category: "ui_display",
    description: "UI display issue — check Applet Web Template, control mappings, and visibility rules",
    probability: 0.7,
    suggestion: "Verify Applet's Web Template exists, controls are mapped to fields, and ShowControl/HideControl logic is correct.",
  },
  {
    pattern: /script|escript|function|invoke/i,
    category: "script_error",
    description: "eScript runtime error — check error handling, variable scope, and method signatures",
    probability: 0.75,
    suggestion: "Add try/catch/finally. Check that all variables are declared. Verify method name in PreInvokeMethod matches.",
    codeExample: `function WebApplet_PreInvokeMethod(MethodName) {\n  try {\n    if (MethodName == "MyMethod") {\n      // logic\n      return CancelOperation;\n    }\n  } catch(e) {\n    TheApplication().RaiseErrorText(e.toString());\n  } finally {\n    // cleanup\n  }\n  return ContinueOperation;\n}`,
  },
  {
    pattern: /permission|access|denied|security/i,
    category: "security",
    description: "Access denied — check responsibility, view/position access, and data-level security",
    probability: 0.7,
    suggestion: "Verify user's responsibility includes the View. Check Position-based access on the BC.",
  },
  {
    pattern: /timeout|slow|performance|hang/i,
    category: "performance",
    description: "Performance issue — check SearchSpec efficiency, unbounded queries, and missing indexes",
    probability: 0.65,
    suggestion: "Add ForwardOnly to ExecuteQuery. Limit result set with SearchSpec. Check for loops with GetFieldValue inside.",
  },
];

const GENERIC_CAUSES: TroubleshootCause[] = [
  {
    description: "Configuration mismatch between objects — check that all referenced objects exist and are compiled",
    probability: 0.5,
    category: "configuration",
    suggestion: "Recompile the project. Verify all dependent objects are imported and active.",
  },
  {
    description: "Stale cache — Siebel server may be serving cached object definitions",
    probability: 0.3,
    category: "cache",
    suggestion: "Clear server cache and restart the Siebel component. On Composer, do a Clean Build.",
  },
];

function analyzeCauses(
  errorMessage: string,
  scripts: readonly RelatedScript[],
  configIssues: readonly ConfigIssue[],
): TroubleshootCause[] {
  const causes: TroubleshootCause[] = [];

  // Match error against known patterns
  for (const rule of CAUSE_RULES) {
    if (rule.pattern.test(errorMessage)) {
      causes.push({
        description: rule.description,
        probability: rule.probability,
        category: rule.category,
        suggestion: rule.suggestion,
        codeExample: rule.codeExample,
      });
    }
  }

  // Check scripts for anti-patterns
  for (const script of scripts) {
    if (!/try\s*\{/.test(script.snippet)) {
      causes.push({
        description: `Script "${script.methodName}" in ${script.parentObject} has no error handling`,
        probability: 0.6,
        category: "script_error",
        suggestion: "Wrap function body in try/catch/finally",
      });
      break; // One is enough
    }
  }

  // Add config-based causes
  for (const issue of configIssues) {
    causes.push({
      description: `Config issue: ${issue.detail} in ${issue.objectName}`,
      probability: 0.55,
      category: "configuration",
      suggestion: `Fix ${issue.issueType} in ${issue.objectName}`,
    });
  }

  // If no specific causes found, add generic ones
  if (causes.length === 0) {
    causes.push(...GENERIC_CAUSES);
  }

  // Sort by probability desc, limit to 5
  causes.sort((a, b) => b.probability - a.probability);
  return causes.slice(0, 5);
}

// --- Main function ---

export function troubleshootSiebel(request: TroubleshootRequest): TroubleshootResult {
  const { errorMessage, objects, dependencies } = request;

  logger.debug("troubleshoot: analyzing", { errorLength: errorMessage.length, objectCount: objects.length });

  // AC1: Parse error to find related objects
  const relatedObjects = extractObjectNames(errorMessage, objects);
  const relatedNames = new Set(relatedObjects.map((o) => o.name));

  // If no objects found by name, try to relate by type keywords
  if (relatedNames.size === 0) {
    for (const obj of objects) {
      if (errorMessage.toLowerCase().includes(obj.type.replace("_", " "))) {
        relatedNames.add(obj.name);
        relatedObjects.push({ name: obj.name, type: obj.type });
        break;
      }
    }
  }

  // AC2: Find related scripts
  const relatedScripts = findRelatedScripts(relatedNames, objects);

  // AC3: Dependency chain
  const dependencyChain = buildDependencyChain(relatedObjects, dependencies);

  // AC4: Config issues
  const configIssues = checkConfigIssues(relatedNames, objects);

  // AC5 + AC6: Causes with suggestions
  const causes = analyzeCauses(errorMessage, relatedScripts, configIssues);

  logger.info("troubleshoot: complete", {
    relatedObjects: relatedObjects.length,
    scripts: relatedScripts.length,
    causes: causes.length,
  });

  return {
    errorMessage,
    relatedObjects,
    relatedScripts,
    dependencyChain,
    configIssues,
    causes,
  };
}
