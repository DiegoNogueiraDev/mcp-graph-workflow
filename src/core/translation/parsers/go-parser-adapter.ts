/**
 * Go Parser Adapter — heuristic regex-based parser for Go code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
  also?: Array<{ constructId: string }>;
}

const LINE_RULES: Rule[] = [
  { pattern: /^import\s+/, constructId: "uc_import_named" },
  { pattern: /^type\s+(\w+)\s+struct\s*\{/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^type\s+(\w+)\s+interface\s*\{/, constructId: "uc_interface", nameGroup: 1 },
  { pattern: /^func\s+\(\w+\s+\*?\w+\)\s+(\w+)/, constructId: "uc_fn_def", nameGroup: 1 }, // method
  { pattern: /^func\s+(\w+)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*go\s+func/, constructId: "uc_async_fn" },
  { pattern: /^\s*if\s+/, constructId: "uc_if_else" },
  { pattern: /^\s*for\s+/, constructId: "uc_for_loop" },
  { pattern: /^\s*switch\s+/, constructId: "uc_switch" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /^\s*defer\s+/, constructId: "uc_try_catch" }, // Go defer ~ finally
];

export class GoParserAdapter implements ParserAdapter {
  readonly languageId = "go";

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
