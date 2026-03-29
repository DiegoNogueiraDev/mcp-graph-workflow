/**
 * C# Parser Adapter — heuristic regex-based parser for C# code.
 */
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

interface Rule {
  pattern: RegExp;
  constructId: string;
  nameGroup?: number;
  also?: Array<{ constructId: string }>;
}

const LINE_RULES: Rule[] = [
  { pattern: /^\s*using\s+[\w.]+;/, constructId: "uc_import_named" },
  // class with inheritance (: BaseClass)
  // eslint-disable-next-line security/detect-unsafe-regex
  { pattern: /^\s*(public|private|protected|internal)?\s*(static\s+)?(abstract\s+|sealed\s+)?class\s+(\w+)\s*:\s*\w+/,
    constructId: "uc_class_def", nameGroup: 4, also: [{ constructId: "uc_extends" }] },
  // eslint-disable-next-line security/detect-unsafe-regex
  { pattern: /^\s*(public|private|protected|internal)?\s*(static\s+)?(abstract\s+)?class\s+(\w+)/, constructId: "uc_class_def", nameGroup: 4 },
  { pattern: /^\s*(public|private|protected|internal)?\s*interface\s+(\w+)/, constructId: "uc_interface", nameGroup: 2 },
  { pattern: /^\s*(public|private|protected|internal)?\s*enum\s+(\w+)/, constructId: "uc_type_enum", nameGroup: 2 },
  // eslint-disable-next-line security/detect-unsafe-regex
  { pattern: /^\s*(public|private|protected|internal)?\s*(static\s+)?(async\s+)?([\w<>?[\]]+)\s+(\w+)\s*\(/, constructId: "uc_fn_def", nameGroup: 5,
    also: [{ constructId: "uc_async_fn" }] },
  { pattern: /^\s*try\s*\{/, constructId: "uc_try_catch" },
  { pattern: /^\s*throw\s+/, constructId: "uc_throw" },
  { pattern: /^\s*if\s*\(/, constructId: "uc_if_else" },
  { pattern: /^\s*}\s*else\b/, constructId: "uc_if_else" },
  { pattern: /^\s*(for|foreach)\s*\(/, constructId: "uc_for_each" },
  { pattern: /^\s*while\s*\(/, constructId: "uc_while" },
  { pattern: /^\s*switch\s*\(/, constructId: "uc_switch" },
  { pattern: /^\s*return\b/, constructId: "uc_return" },
  { pattern: /\bawait\s+/, constructId: "uc_await" },
];

export class CSharpParserAdapter implements ParserAdapter {
  readonly languageId = "csharp";

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
            // uc_async_fn should only be emitted if "async" actually appears in the line
            if (extra.constructId === "uc_async_fn" && !line.includes("async")) continue;
            constructs.push({ constructId: extra.constructId, startLine: lineNum, endLine: lineNum });
          }
        }

        break;
      }
    }
    return constructs;
  }
}
