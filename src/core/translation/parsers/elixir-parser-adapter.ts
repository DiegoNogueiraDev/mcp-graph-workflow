/**
 * Elixir Parser Adapter — heuristic regex-based parser for Elixir code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*import\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*alias\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*use\s+/, constructId: "uc_import_named" },
  { pattern: /^\s*defmodule\s+(\w[\w.]*)/, constructId: "uc_class_def", nameGroup: 1 },
  { pattern: /^\s*def\s+(\w+[?!]?)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*defp\s+(\w+[?!]?)\s*\(/, constructId: "uc_fn_def", nameGroup: 1 },
  { pattern: /^\s*try\s+do\b/, constructId: "uc_try_catch" },
  { pattern: /^\s*rescue\b/, constructId: "uc_try_catch" },
  { pattern: /^\s*raise\s+/, constructId: "uc_throw" },
  { pattern: /^\s*cond\s+do\b/, constructId: "uc_if_else" },
  { pattern: /^\s*if\s+/, constructId: "uc_if_else" },
  { pattern: /^\s*unless\s+/, constructId: "uc_if_else" },
  { pattern: /^\s*case\s+.+\s+do\b/, constructId: "uc_switch" },
  { pattern: /^\s*for\s+.+<-\s*.+do\b/, constructId: "uc_for_each" },
  { pattern: /Enum\.each\b/, constructId: "uc_for_each" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
];

export class ElixirParserAdapter implements ParserAdapter {
  readonly languageId = "elixir";

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
