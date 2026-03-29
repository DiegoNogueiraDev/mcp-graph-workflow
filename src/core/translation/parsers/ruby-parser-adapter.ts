/**
 * Ruby Parser Adapter — heuristic regex-based parser for Ruby code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*require\s+['"]/, constructId: "uc_import_named" },
  { pattern: /^\s*require_relative\s+['"]/, constructId: "uc_import_named" },
  { pattern: /^\s*class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*module\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*def\s+(\w+[?!]?)/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*begin\s*$/, constructId: "uc_try_catch" },
  { pattern: /^\s*rescue\b/, constructId: "uc_try_catch" },
  { pattern: /^\s*raise\s+/, constructId: "uc_throw" },
  { pattern: /^\s*if\s+/, constructId: "uc_if_else" },
  { pattern: /^\s*unless\s+/, constructId: "uc_if_else" },
  { pattern: /^\s*while\s+/, constructId: "uc_while" },
  { pattern: /^\s*until\s+/, constructId: "uc_while" },
  { pattern: /^\s*for\s+\w+\s+in\s+/, constructId: "uc_for_each" },
  { pattern: /\.each\s+do/, constructId: "uc_for_each" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /^\s*yield\b/, constructId: "uc_return" },
];

export class RubyParserAdapter implements ParserAdapter {
  readonly languageId = "ruby";

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
