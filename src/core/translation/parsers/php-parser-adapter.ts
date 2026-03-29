/**
 * PHP Parser Adapter — heuristic regex-based parser for PHP code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*<\?php\b/, constructId: "uc_import_named" },
  { pattern: /^\s*namespace\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*use\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*interface\s+(\w+)/, constructId: "uc_interface", nameGroup: 1 },
  { pattern: /^\s*(?:(?:public|private|protected|static)\s+)*function\s+(\w+)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*try\s*\{/, constructId: "uc_try_catch" },
  { pattern: /^\s*catch\b/, constructId: "uc_try_catch" },
  { pattern: /^\s*throw\s+/, constructId: "uc_throw" },
  { pattern: /^\s*if\s*\(/, constructId: "uc_if_else" },
  { pattern: /^\s*foreach\s*\(/, constructId: "uc_for_each" },
  { pattern: /^\s*for\s*\(/, constructId: "uc_for_loop" },
  { pattern: /^\s*while\s*\(/, constructId: "uc_while" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /^\s*switch\s*\(/, constructId: "uc_switch" },
];

export class PhpParserAdapter implements ParserAdapter {
  readonly languageId = "php";

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
