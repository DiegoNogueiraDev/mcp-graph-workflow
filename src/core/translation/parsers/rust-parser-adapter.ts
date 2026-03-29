/**
 * Rust Parser Adapter — heuristic regex-based parser for Rust code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*use\s+[\w:]+/, constructId: "uc_import_named" },
  { pattern: /^\s*async\s+fn\s+(\w+)/, constructId: "uc_async_fn", nameGroup: 1 },
  // eslint-disable-next-line security/detect-unsafe-regex
  { pattern: /^\s*(pub\s+)?(unsafe\s+)?fn\s+(\w+)/, constructId: "uc_fn_def", nameGroup: 3 },
  // eslint-disable-next-line security/detect-unsafe-regex
  { pattern: /^\s*(pub\s+)?struct\s+(\w+)/, constructId: "uc_class_def", nameGroup: 2 },
  // eslint-disable-next-line security/detect-unsafe-regex
  { pattern: /^\s*(pub\s+)?enum\s+(\w+)/, constructId: "uc_class_def", nameGroup: 2 },
  // eslint-disable-next-line security/detect-unsafe-regex
  { pattern: /^\s*(pub\s+)?trait\s+(\w+)/, constructId: "uc_interface", nameGroup: 2 },
  { pattern: /^\s*impl\s+([\w<>]+)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*match\s+/, constructId: "uc_switch" },
  { pattern: /^\s*if\s+/, constructId: "uc_if_else" },
  { pattern: /^\s*loop\s*\{/, constructId: "uc_while" },
  { pattern: /^\s*while\s+/, constructId: "uc_while" },
  { pattern: /^\s*for\s+\w+\s+in\s+/, constructId: "uc_for_each" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /\.await\b/, constructId: "uc_await" },
];

export class RustParserAdapter implements ParserAdapter {
  readonly languageId = "rust";

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
