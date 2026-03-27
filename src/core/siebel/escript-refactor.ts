/**
 * eScript Refactoring Engine — analyzes Siebel eScript code and applies
 * automatic refactorings: dead code removal, try/catch/finally injection,
 * memory cleanup, duplicate lookup detection, unused variables.
 */

import { logger } from "../utils/logger.js";

// --- Public types ---

export interface RefactorIssue {
  readonly type:
    | "dead_code"
    | "unused_variable"
    | "duplicate_lookup"
    | "missing_try_catch"
    | "missing_cleanup"
    | "missing_activate_field";
  readonly detail: string;
  readonly suggestion: string;
  readonly line?: number;
}

export interface DiffLine {
  readonly type: "added" | "removed" | "unchanged";
  readonly content: string;
}

export interface RefactorResult {
  readonly original: string;
  readonly refactored: string;
  readonly issues: readonly RefactorIssue[];
  readonly diff: readonly DiffLine[];
}

// --- Detection helpers ---

/** AC1: Find dead code blocks marked with comments */
function detectDeadCode(code: string): { issues: RefactorIssue[]; cleaned: string } {
  const issues: RefactorIssue[] = [];
  let cleaned = code;

  // Pattern: /* ... Dead Code ... */ ... /* End Dead Code */
  const blockPattern = /\/\*[^*]*(?:Dead\s*Code|DEAD\s*CODE)[^*]*\*\/[\s\S]*?\/\*[^*]*End\s*Dead\s*Code[^*]*\*\//gi;
  const blockMatches = code.match(blockPattern);
  if (blockMatches) {
    for (const match of blockMatches) {
      issues.push({
        type: "dead_code",
        detail: `Block dead code: ${match.substring(0, 60)}...`,
        suggestion: "Remove dead code block",
      });
      cleaned = cleaned.replace(match, "");
    }
  }

  // Pattern: // Dead Code ... // End Dead Code (line-based)
  const linePattern = /\/\/\s*Dead\s*Code[^\n]*\n[\s\S]*?\/\/\s*End\s*Dead\s*Code[^\n]*/gi;
  const lineMatches = code.match(linePattern);
  if (lineMatches) {
    for (const match of lineMatches) {
      if (!blockMatches?.some((b) => b.includes(match))) {
        issues.push({
          type: "dead_code",
          detail: `Line dead code: ${match.substring(0, 60)}...`,
          suggestion: "Remove dead code block",
        });
        cleaned = cleaned.replace(match, "");
      }
    }
  }

  // Clean up multiple blank lines left by removal
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return { issues, cleaned };
}

/** AC2: Detect unused variables */
function detectUnusedVariables(code: string): RefactorIssue[] {
  const issues: RefactorIssue[] = [];

  // Find var declarations
  const varPattern = /\bvar\s+(\w+)\s*(?:=|;)/g;
  let match;
  while ((match = varPattern.exec(code)) !== null) {
    const varName = match[1];
    // Count occurrences after declaration (excluding the declaration itself)
    const afterDecl = code.substring(match.index + match[0].length);
    const usagePattern = new RegExp(`\\b${escapeRegex(varName)}\\b`, "g");
    const usages = afterDecl.match(usagePattern);

    if (!usages || usages.length === 0) {
      issues.push({
        type: "unused_variable",
        detail: `Variable "${varName}" is declared but never used`,
        suggestion: `Remove unused variable "${varName}"`,
      });
    }
  }

  return issues;
}

/** AC3: Detect duplicate LOV lookups */
function detectDuplicateLookups(code: string): RefactorIssue[] {
  const issues: RefactorIssue[] = [];

  const lookupPattern = /InvokeMethod\s*\(\s*"LookupValue"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  const lookups = new Map<string, number>();
  let match;

  while ((match = lookupPattern.exec(code)) !== null) {
    const key = `${match[1]}:${match[2]}`;
    lookups.set(key, (lookups.get(key) ?? 0) + 1);
  }

  for (const [key, count] of lookups) {
    if (count > 1) {
      const [lov, value] = key.split(":");
      issues.push({
        type: "duplicate_lookup",
        detail: `LookupValue("${lov}", "${value}") called ${count} times`,
        suggestion: `Cache LookupValue result in a variable: var cached_${lov}_${value.replace(/\s+/g, "_")} = ...`,
      });
    }
  }

  return issues;
}

/** AC4: Detect missing try/catch/finally */
function detectMissingTryCatch(code: string): boolean {
  const hasFunction = /function\s+\w+/.test(code);
  const hasTry = /\btry\s*\{/.test(code);
  return hasFunction && !hasTry;
}

/** AC4: Wrap function body in try/catch/finally */
function addTryCatchFinally(code: string, siebelVars: string[]): string {
  // Find function body
  const funcMatch = code.match(/(function\s+\w+\s*\([^)]*\)\s*\{)([\s\S]*?)(\})\s*$/);
  if (!funcMatch) return code;

  const funcHeader = funcMatch[1];
  const body = funcMatch[2];
  const indent = "  ";

  // Indent body
  const indentedBody = body
    .split("\n")
    .map((line) => (line.trim() ? `${indent}${indent}${line.trimStart()}` : ""))
    .join("\n");

  const cleanup = siebelVars.length > 0
    ? siebelVars.map((v) => `${indent}${indent}${v} = null;`).join("\n")
    : "";

  return `${funcHeader}
${indent}try {
${indentedBody}
${indent}} catch(e) {
${indent}${indent}TheApplication().RaiseErrorText(e.toString());
${indent}} finally {
${cleanup}
${indent}}
}`;
}

/** AC5: Detect Siebel objects that need cleanup */
function detectSiebelObjects(code: string): string[] {
  const patterns = [
    /\bvar\s+(\w+)\s*=\s*TheApplication\(\)\s*\.\s*(?:GetBusComp|GetService|GetBusObject|ActiveBusComp)\s*\(/g,
    /\bvar\s+(\w+)\s*=\s*\w+\s*\.\s*(?:GetBusComp|GetService|GetMVGBusComp|GetPicklistBusComp)\s*\(/g,
  ];

  const vars = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      vars.add(match[1]);
    }
  }

  return [...vars];
}

/** AC5: Detect missing cleanup in finally */
function detectMissingCleanup(code: string): { issues: RefactorIssue[]; vars: string[] } {
  const issues: RefactorIssue[] = [];
  const siebelVars = detectSiebelObjects(code);

  // Check if finally block exists and has null assignments
  const finallyMatch = code.match(/finally\s*\{([\s\S]*?)\}/);
  const finallyBody = finallyMatch ? finallyMatch[1] : "";

  const uncleaned: string[] = [];
  for (const varName of siebelVars) {
    const hasCleanup = new RegExp(`\\b${escapeRegex(varName)}\\s*=\\s*null`, "g").test(finallyBody);
    if (!hasCleanup) {
      uncleaned.push(varName);
    }
  }

  if (uncleaned.length > 0) {
    issues.push({
      type: "missing_cleanup",
      detail: `Siebel objects not cleaned up: ${uncleaned.join(", ")}`,
      suggestion: `Add null assignments in finally block: ${uncleaned.map((v) => `${v} = null;`).join(" ")}`,
    });
  }

  return { issues, vars: uncleaned };
}

/** AC5: Inject cleanup into finally block */
function injectCleanup(code: string, vars: string[]): string {
  if (vars.length === 0) return code;

  const finallyMatch = code.match(/(finally\s*\{)([\s\S]*?)(\})\s*$/);
  if (!finallyMatch) return code;

  const indent = "    ";
  const assignments = vars.map((v) => `${indent}${v} = null;`).join("\n");
  const existingBody = finallyMatch[2].trim();
  const newBody = existingBody
    ? `\n${assignments}\n${indent}${existingBody}\n  `
    : `\n${assignments}\n  `;

  return code.replace(
    /(finally\s*\{)([\s\S]*?)(\})\s*$/,
    `$1${newBody}$3`,
  );
}

/** AC6: Detect GetFieldValue without ActivateField */
function detectMissingActivateField(code: string): RefactorIssue[] {
  const issues: RefactorIssue[] = [];

  // Find all GetFieldValue calls
  const getFieldPattern = /GetFieldValue\s*\(\s*"([^"]+)"\s*\)/g;
  const fields = new Set<string>();
  let match;

  while ((match = getFieldPattern.exec(code)) !== null) {
    fields.add(match[1]);
  }

  // Find all ActivateField calls
  const activatePattern = /ActivateField\s*\(\s*"([^"]+)"\s*\)/g;
  const activatedFields = new Set<string>();

  while ((match = activatePattern.exec(code)) !== null) {
    activatedFields.add(match[1]);
  }

  for (const field of fields) {
    if (!activatedFields.has(field)) {
      issues.push({
        type: "missing_activate_field",
        detail: `GetFieldValue("${field}") without prior ActivateField("${field}")`,
        suggestion: `Add bc.ActivateField("${field}") before query execution`,
      });
    }
  }

  return issues;
}

/** AC7: Generate simple diff */
function generateDiff(original: string, refactored: string): DiffLine[] {
  if (original === refactored) return [];

  const origLines = original.split("\n");
  const refLines = refactored.split("\n");
  const diff: DiffLine[] = [];

  // Simple line-by-line diff (not a full diff algorithm, but sufficient for refactoring output)
  const origSet = new Set(origLines.map((l) => l.trim()));
  const refSet = new Set(refLines.map((l) => l.trim()));

  for (const line of origLines) {
    if (!refSet.has(line.trim()) && line.trim()) {
      diff.push({ type: "removed", content: line });
    }
  }

  for (const line of refLines) {
    if (!origSet.has(line.trim()) && line.trim()) {
      diff.push({ type: "added", content: line });
    }
  }

  return diff;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Main function ---

export function refactorEscript(code: string): RefactorResult {
  if (!code || code.trim().length === 0) {
    return { original: code, refactored: code, issues: [], diff: [] };
  }

  logger.debug("escript-refactor: analyzing script", { length: code.length });

  const allIssues: RefactorIssue[] = [];
  let refactored = code;

  // AC1: Dead code removal
  const deadCode = detectDeadCode(refactored);
  allIssues.push(...deadCode.issues);
  refactored = deadCode.cleaned;

  // AC2: Unused variables (detection only, no auto-removal)
  allIssues.push(...detectUnusedVariables(refactored));

  // AC3: Duplicate lookups (detection only)
  allIssues.push(...detectDuplicateLookups(refactored));

  // AC6: Missing ActivateField (detection only)
  allIssues.push(...detectMissingActivateField(refactored));

  // AC4: Missing try/catch/finally (auto-fix)
  if (detectMissingTryCatch(refactored)) {
    const siebelVars = detectSiebelObjects(refactored);
    allIssues.push({
      type: "missing_try_catch",
      detail: "Function has no try/catch error handling",
      suggestion: "Wrap function body in try/catch/finally with error handling",
    });
    refactored = addTryCatchFinally(refactored, siebelVars);
  } else {
    // AC5: Missing cleanup in existing finally (auto-fix)
    const cleanup = detectMissingCleanup(refactored);
    allIssues.push(...cleanup.issues);
    if (cleanup.vars.length > 0) {
      refactored = injectCleanup(refactored, cleanup.vars);
    }
  }

  // AC7: Diff
  const diff = generateDiff(code, refactored);

  logger.info("escript-refactor: complete", {
    issues: allIssues.length,
    hasChanges: diff.length > 0,
  });

  return { original: code, refactored, issues: allIssues, diff };
}
