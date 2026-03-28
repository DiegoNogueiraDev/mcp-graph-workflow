/**
 * TypeScript Generator — emits TypeScript code from canonical constructs
 * using UCR syntax patterns with {{placeholder}} substitution.
 */

import { ConstructRegistry } from "../ucr/construct-registry.js";
import type { GeneratorAdapter, GeneratedCode } from "./generator-adapter.js";
import type { ParsedConstruct } from "../parsers/parser-adapter.js";

export class TsGenerator implements GeneratorAdapter {
  readonly languageId = "typescript";

  constructor(private readonly registry: ConstructRegistry) {}

  generate(constructs: ParsedConstruct[]): GeneratedCode {
    if (constructs.length === 0) {
      return { code: "", mappedConstructs: [], unmappedConstructs: [] };
    }

    const lines: string[] = [];
    const mapped: string[] = [];
    const unmapped: string[] = [];

    for (const construct of constructs) {
      const mapping = this.registry.getPrimaryMapping(construct.constructId, this.languageId);

      if (!mapping || !mapping.syntaxPattern) {
        unmapped.push(construct.constructId);
        continue;
      }

      const code = substitutePattern(mapping.syntaxPattern, construct);
      lines.push(code);
      mapped.push(construct.constructId);
    }

    return {
      code: lines.join("\n\n"),
      mappedConstructs: mapped,
      unmappedConstructs: unmapped,
    };
  }
}

/** Substitute {{placeholders}} in a syntax pattern with construct data. */
function substitutePattern(pattern: string, construct: ParsedConstruct): string {
  let result = pattern;
  if (construct.name) {
    result = result.replace(/\{\{name\}\}/g, construct.name);
  }
  // Default placeholders for unresolved template vars
  result = result.replace(/\{\{members\}\}/g, "// TODO: members");
  result = result.replace(/\{\{params\}\}/g, "");
  result = result.replace(/\{\{body\}\}/g, "// TODO: implement");
  result = result.replace(/\{\{value\}\}/g, "undefined");
  result = result.replace(/\{\{condition\}\}/g, "/* condition */");
  result = result.replace(/\{\{type\}\}/g, "unknown");
  result = result.replace(/\{\{module\}\}/g, "'./module'");
  result = result.replace(/\{\{items\}\}/g, "items");
  result = result.replace(/\{\{item\}\}/g, "item");
  result = result.replace(/\{\{expression\}\}/g, "/* expression */");
  result = result.replace(/\{\{error\}\}/g, "e");
  result = result.replace(/\{\{message\}\}/g, "'Error'");
  return result;
}
