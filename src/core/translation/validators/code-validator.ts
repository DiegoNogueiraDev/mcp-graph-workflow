/**
 * Code Validators — syntax validation for translated code.
 *
 * TypeScript: uses ts.createSourceFile to parse and detect syntax errors.
 * Python: uses heuristic checks (indentation, brackets, colons, keywords).
 *
 * No external dependencies — all local analysis.
 */

import ts from "typescript";

// ── Types ──────────────────────────────────────────

export interface ValidationError {
  line: number;
  column?: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  language: string;
  errors: ValidationError[];
}

// ── TypeScript Validator ───────────────────────────

/**
 * Validate TypeScript code by parsing with the TS compiler.
 * Detects syntax errors (not type errors — no type-checker).
 */
export function validateTypescript(code: string): ValidationResult {
  const sourceFile = ts.createSourceFile(
    "validation.ts",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const errors: ValidationError[] = [];

  // Access internal parseDiagnostics (not public API — may change in future TS versions).
  // The public alternative ts.getPreEmitDiagnostics() requires a Program, which is heavier.
  const diagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];

  for (const diag of diagnostics) {
    const pos = sourceFile.getLineAndCharacterOfPosition(diag.start ?? 0);
    errors.push({
      line: pos.line + 1,
      column: pos.character + 1,
      message: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
    });
  }

  return {
    valid: errors.length === 0,
    language: "typescript",
    errors,
  };
}

// ── Python Validator ───────────────────────────────

/**
 * Validate Python code using heuristic checks.
 * Checks: indentation consistency, bracket matching, colon placement,
 * basic keyword structure.
 */
export function validatePython(code: string): ValidationResult {
  const errors: ValidationError[] = [];
  const lines = code.split("\n");

  // Check bracket/paren matching
  const bracketErrors = checkBracketMatching(lines);
  errors.push(...bracketErrors);

  // Check indentation after colon-terminated lines
  const indentErrors = checkPythonIndentation(lines);
  errors.push(...indentErrors);

  // Check colon placement on def/class/if/for/while/try/except/with
  const colonErrors = checkColonPlacement(lines);
  errors.push(...colonErrors);

  return {
    valid: errors.length === 0,
    language: "python",
    errors,
  };
}

// ── Python Heuristic Helpers ───────────────────────

function checkBracketMatching(lines: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const stack: Array<{ char: string; line: number }> = [];
  const openers: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const closers: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip strings (simplified — doesn't handle all edge cases)
    let inString = false;
    let stringChar = "";

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];

      if (!inString && (ch === "'" || ch === '"')) {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (inString && ch === stringChar) {
        inString = false;
        continue;
      }
      if (inString || ch === "#") break; // comment — skip rest of line

      if (openers[ch]) {
        stack.push({ char: ch, line: i + 1 });
      } else if (closers[ch]) {
        if (stack.length === 0 || stack[stack.length - 1].char !== closers[ch]) {
          errors.push({ line: i + 1, message: `Unmatched '${ch}'` });
        } else {
          stack.pop();
        }
      }
    }
  }

  for (const item of stack) {
    errors.push({ line: item.line, message: `Unmatched '${item.char}'` });
  }

  return errors;
}

function checkPythonIndentation(lines: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const blockKeywords = /^\s*(def |class |if |elif |else:|for |while |try:|except |finally:|with |async def |async for |async with )/;

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip empty lines and comments
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // If line ends with colon (block opener), next non-empty line must be indented more
    if (trimmed.endsWith(":") && blockKeywords.test(line)) {
      const currentIndent = line.length - trimmed.length;
      const nextLine = findNextNonEmptyLine(lines, i + 1);
      if (nextLine !== null) {
        const nextTrimmed = lines[nextLine].trimStart();
        const nextIndent = lines[nextLine].length - nextTrimmed.length;
        if (nextIndent <= currentIndent && nextTrimmed !== "" && !nextTrimmed.startsWith("#")) {
          errors.push({
            line: nextLine + 1,
            message: `Expected indented block after '${trimmed.slice(0, 30)}'`,
          });
        }
      }
    }
  }

  return errors;
}

function checkColonPlacement(lines: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const needsColon = /^\s*(def |class |if |elif |else|for |while |try|except |finally|with |async def |async for |async with )/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (needsColon.test(line)) {
      // These keywords need a colon at end of line (or before comment)
      const withoutComment = trimmed.split("#")[0].trimEnd();
      if (!withoutComment.endsWith(":") && !withoutComment.endsWith(":\\")) {
        // Allow multi-line (line ending with \ or open bracket)
        if (!withoutComment.endsWith("\\") && !withoutComment.endsWith(",") && !withoutComment.endsWith("(")) {
          errors.push({
            line: i + 1,
            message: `Expected ':' at end of '${trimmed.slice(0, 40)}'`,
          });
        }
      }
    }
  }

  return errors;
}

function findNextNonEmptyLine(lines: string[], start: number): number | null {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() !== "") return i;
  }
  return null;
}
