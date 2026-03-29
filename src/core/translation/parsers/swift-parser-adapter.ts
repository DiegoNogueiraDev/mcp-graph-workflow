/**
 * Swift Parser Adapter — heuristic regex-based parser for Swift code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*import\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*struct\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*protocol\s+(\w+)/, constructId: "uc_interface", nameGroup: 1 },
  { pattern: /^\s*func\s+(\w+)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*do\s*\{/, constructId: "uc_try_catch" },
  { pattern: /^\s*catch\b/, constructId: "uc_try_catch" },
  { pattern: /^\s*throw\s+/, constructId: "uc_throw" },
  { pattern: /^\s*if\b/, constructId: "uc_if_else" },
  { pattern: /^\s*guard\b/, constructId: "uc_if_else" },
  { pattern: /^\s*for\s+\w+\s+in\s+/, constructId: "uc_for_each" },
  { pattern: /^\s*while\b/, constructId: "uc_while" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /^\s*switch\b/, constructId: "uc_switch" },
  { pattern: /^\s*enum\s+(\w+)/, constructId: "uc_type_enum", nameGroup: 1 },
];

export class SwiftParserAdapter implements ParserAdapter {
  readonly languageId = "swift";

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
