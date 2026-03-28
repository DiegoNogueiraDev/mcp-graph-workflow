/**
 * Python Parser Adapter — heuristic regex + line-based parser for Python code.
 * Maps detected constructs to UCR canonical IDs without requiring a Python AST library.
 */

import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
  /** Additional constructs to emit alongside the main one */
  also?: Array<{ constructId: string }>;
}

const LINE_RULES: Rule[] = [
  // async def must come before def
  { pattern: /^(\s*)async\s+def\s+(\w+)/, constructId: "uc_async_fn", nameGroup: 2 },
  { pattern: /^(\s*)def\s+(\w+)/, constructId: "uc_fn_def", nameGroup: 2 },
  // class with inheritance
  {
    pattern: /^(\s*)class\s+(\w+)\s*\([^)]+\)\s*:/,
    constructId: "uc_class_def",
    nameGroup: 2,
    also: [{ constructId: "uc_extends" }],
  },
  // class without inheritance
  { pattern: /^(\s*)class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 2 },
  // from x import y (named import)
  { pattern: /^from\s+\S+\s+import\s+/, constructId: "uc_import_named" },
  // import x (default/module import)
  { pattern: /^import\s+\w+/, constructId: "uc_import_default" },
  // if/elif/else
  { pattern: /^(\s*)(if|elif)\s+.+:/, constructId: "uc_if_else" },
  // for loop (Python for is always for-each style)
  { pattern: /^(\s*)for\s+\w+\s+in\s+/, constructId: "uc_for_each" },
  // while loop
  { pattern: /^(\s*)while\s+/, constructId: "uc_while" },
  // try/except
  { pattern: /^(\s*)try\s*:/, constructId: "uc_try_catch" },
  // raise (throw)
  { pattern: /^(\s*)raise\s+/, constructId: "uc_throw" },
  // return
  { pattern: /^(\s*)return\b/, constructId: "uc_return" },
  // await expression
  { pattern: /\bawait\s+/, constructId: "uc_await" },
  // continue
  { pattern: /^(\s*)continue\s*$/, constructId: "uc_continue" },
  // break
  { pattern: /^(\s*)break\s*$/, constructId: "uc_break" },
];

export class PythonParserAdapter implements ParserAdapter {
  readonly languageId = "python";

  parseSnippet(code: string): ParsedConstruct[] {
    if (!code.trim()) return [];

    const lines = code.split("\n");
    const constructs: ParsedConstruct[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const rule of LINE_RULES) {
        const match = rule.pattern.exec(line);
        if (!match) continue;

        // Deduplicate if/else — only emit once per if block
        if (rule.constructId === "uc_if_else") {
          const key = `${rule.constructId}:${lineNum}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }

        const name = rule.nameGroup ? match[rule.nameGroup] : undefined;
        constructs.push({
          constructId: rule.constructId,
          name,
          startLine: lineNum,
          endLine: lineNum,
        });

        if (rule.also) {
          for (const extra of rule.also) {
            constructs.push({
              constructId: extra.constructId,
              startLine: lineNum,
              endLine: lineNum,
            });
          }
        }

        break; // Only first matching rule per line
      }
    }

    return constructs;
  }
}
