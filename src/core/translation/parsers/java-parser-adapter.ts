/**
 * Java Parser Adapter — heuristic regex-based parser for Java code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
  also?: Array<{ constructId: string }>;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*import\s+[\w.]+;/, constructId: "uc_import_named" },
  { pattern: /^\s*(public|private|protected)?\s*(abstract\s+)?class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 3 },
  { pattern: /^\s*(public|private|protected)?\s*interface\s+(\w+)/, constructId: "uc_interface", nameGroup: 2 },
  { pattern: /^\s*(public|private|protected)?\s*(static\s+)?(synchronized\s+)?([\w<>\[\]]+)\s+(\w+)\s*\(/, constructId: "uc_fn_def", nameGroup: 5 },
  { pattern: /^\s*try\s*\{/, constructId: "uc_try_catch" },
  { pattern: /^\s*throw\s+/, constructId: "uc_throw" },
  { pattern: /^\s*if\s*\(/, constructId: "uc_if_else" },
  { pattern: /^\s*for\s*\(/, constructId: "uc_for_loop" },
  { pattern: /^\s*(while)\s*\(/, constructId: "uc_while" },
  { pattern: /^\s*switch\s*\(/, constructId: "uc_switch" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /\bawait\s+/, constructId: "uc_await" },
];

export class JavaParserAdapter implements ParserAdapter {
  readonly languageId = "java";

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
        if (rule.also) {
          for (const extra of rule.also) {
            constructs.push({ constructId: extra.constructId, startLine: lineNum, endLine: lineNum });
          }
        }
        break;
      }
    }
    return constructs;
  }
}
