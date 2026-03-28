/**
 * Python Generator — emits Python code from canonical constructs
 * using UCR syntax patterns. Handles indentation, snake_case naming,
 * and Python-specific imports.
 */

import { ConstructRegistry } from "../ucr/construct-registry.js";
import type { GeneratorAdapter, GeneratedCode } from "./generator-adapter.js";
import type { ParsedConstruct } from "../parsers/parser-adapter.js";

export class PythonGenerator implements GeneratorAdapter {
  readonly languageId = "python";

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

/** Convert camelCase to snake_case for Python naming conventions. */
function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** Check if a name is PascalCase (class-like). */
function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

/** Substitute {{placeholders}} in a syntax pattern with construct data. */
function substitutePattern(pattern: string, construct: ParsedConstruct): string {
  let result = pattern;

  if (construct.name) {
    // Keep PascalCase for classes, convert functions/variables to snake_case
    const isClass = construct.constructId === "uc_class_def" || construct.constructId === "uc_abstract_class";
    const name = isClass || isPascalCase(construct.name) && isClass
      ? construct.name
      : toSnakeCase(construct.name);
    result = result.replace(/\{\{name\}\}/g, name);
  }

  // Default placeholders for unresolved template vars
  result = result.replace(/\{\{members\}\}/g, "pass  # TODO: members");
  result = result.replace(/\{\{params\}\}/g, "");
  result = result.replace(/\{\{body\}\}/g, "pass  # TODO: implement");
  result = result.replace(/\{\{value\}\}/g, "None");
  result = result.replace(/\{\{condition\}\}/g, "True  # condition");
  result = result.replace(/\{\{type\}\}/g, "Any");
  result = result.replace(/\{\{module\}\}/g, "module");
  result = result.replace(/\{\{items\}\}/g, "items");
  result = result.replace(/\{\{item\}\}/g, "item");
  result = result.replace(/\{\{expression\}\}/g, "None  # expression");
  result = result.replace(/\{\{error\}\}/g, "e");
  result = result.replace(/\{\{message\}\}/g, "'Error'");
  result = result.replace(/\{\{parent\}\}/g, "object");
  return result;
}
