/**
 * Lua Parser Adapter — heuristic regex-based parser for Lua code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*(?:local\s+)?(\w+)\s*=\s*require\s*[('"]+/, constructId: "uc_import_named" },
  { pattern: /^\s*require\s*[('"]+/, constructId: "uc_import_named" },
  { pattern: /^\s*local\s+function\s+(\w+)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*function\s+([.\w:]+)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /\bpcall\s*\(/, constructId: "uc_try_catch" },
  { pattern: /\bxpcall\s*\(/, constructId: "uc_try_catch" },
  { pattern: /\berror\s*\(/, constructId: "uc_throw" },
  { pattern: /\bfunction\s*\(/, constructId: "uc_fn_def" },
  { pattern: /^\s*if\s+.+\s+then/, constructId: "uc_if_else" },
  { pattern: /^\s*for\s+.+\s+do/, constructId: "uc_for_each" },
  { pattern: /^\s*while\s+.+\s+do/, constructId: "uc_while" },
  { pattern: /^\s*repeat\s*$/, constructId: "uc_while" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
];

export class LuaParserAdapter implements ParserAdapter {
  readonly languageId = "lua";

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
