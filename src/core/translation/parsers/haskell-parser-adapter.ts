/**
 * Haskell Parser Adapter — heuristic regex-based parser for Haskell code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*import\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*module\s+(\w+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*class\s+(\w+)/, constructId: "uc_interface", nameGroup: 1 },
  { pattern: /^\s*data\s+(\w+)/, constructId: "uc_type_enum", nameGroup: 1 },
  { pattern: /^\s*newtype\s+(\w+)/, constructId: "uc_type_enum", nameGroup: 1 },
  { pattern: /^\s*type\s+(\w+)/, constructId: "uc_type_enum", nameGroup: 1 },
  { pattern: /^\s*(\w+)\s*::/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*case\s+.+\s+of/, constructId: "uc_switch" },
  { pattern: /^\s*if\s+.+\s+then/, constructId: "uc_if_else" },
];

export class HaskellParserAdapter implements ParserAdapter {
  readonly languageId = "haskell";

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
