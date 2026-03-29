/**
 * Dart Parser Adapter — heuristic regex-based parser for Dart code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*import\s+['"]/, constructId: "uc_import_named" },
  { pattern: /^\s*abstract\s+class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*mixin\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*enum\s+(\w+)/, constructId: "uc_type_enum", nameGroup: 1 },
  { pattern: /^\s*(?:async\s+)?Future\s*</, constructId: "uc_async_fn" },
  { pattern: /^\s*(?:\w+\s+)+(\w+)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*try\s*\{/, constructId: "uc_try_catch" },
  { pattern: /^\s*throw\s+/, constructId: "uc_throw" },
  { pattern: /^\s*if\s*\(/, constructId: "uc_if_else" },
  { pattern: /^\s*switch\s*\(/, constructId: "uc_switch" },
  { pattern: /^\s*for\s*\(/, constructId: "uc_for_loop" },
  { pattern: /^\s*while\s*\(/, constructId: "uc_while" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /\basync\b/, constructId: "uc_async_fn" },
];

export class DartParserAdapter implements ParserAdapter {
  readonly languageId = "dart";

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
