/**
 * C++ Parser Adapter — heuristic regex-based parser for C++ code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*#include\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*using\s+namespace\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*template\s*</, constructId: "uc_class_def" },
  { pattern: /^\s*class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*struct\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*namespace\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*enum\s+/, constructId: "uc_type_enum" },
  { pattern: /^\s*try\s*\{/, constructId: "uc_try_catch" },
  { pattern: /^\s*catch\s*\(/, constructId: "uc_try_catch" },
  { pattern: /^\s*throw\s+/, constructId: "uc_throw" },
  { pattern: /^\s*if\s*\(/, constructId: "uc_if_else" },
  { pattern: /^\s*for\s*\(/, constructId: "uc_for_loop" },
  { pattern: /^\s*while\s*\(/, constructId: "uc_while" },
  { pattern: /^\s*switch\s*\(/, constructId: "uc_switch" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /^\s*(?:[\w:*&<>]+\s+)+(\w+)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
];

export class CppParserAdapter implements ParserAdapter {
  readonly languageId = "cpp";

  parseSnippet(code: string): ParsedConstruct[] {
    if (!code.trim()) return [];
    const lines = code.split("\n");
    const constructs: ParsedConstruct[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      for (const rule of LINE_RULES) {
        const match = rule.pattern.exec(line);
        if (!match) continue;
        constructs.push({
          constructId: rule.constructId,
          name: rule.nameGroup ? match[rule.nameGroup] : undefined,
          startLine: lineNum,
          endLine: lineNum,
        });
        break;
      }
    }
    return constructs;
  }
}
