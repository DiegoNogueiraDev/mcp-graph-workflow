/**
 * Scala Parser Adapter — heuristic regex-based parser for Scala code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*import\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*case\s+class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*object\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*trait\s+(\w+)/, constructId: "uc_interface", nameGroup: 1 },
  { pattern: /^\s*def\s+(\w+)\s*[:(]/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*try\s*\{/, constructId: "uc_try_catch" },
  { pattern: /^\s*throw\s+/, constructId: "uc_throw" },
  { pattern: /^\s*if\s*\(/, constructId: "uc_if_else" },
  { pattern: /\bmatch\s*\{/, constructId: "uc_switch" },
  { pattern: /^\s*for\s*[({]/, constructId: "uc_for_each" },
  { pattern: /^\s*while\s*\(/, constructId: "uc_while" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /^\s*sealed\s+/, constructId: "uc_type_enum" },
];

export class ScalaParserAdapter implements ParserAdapter {
  readonly languageId = "scala";

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
