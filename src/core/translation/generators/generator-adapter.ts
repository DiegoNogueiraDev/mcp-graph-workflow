/**
 * Generator Adapter interface — language-agnostic contract for generating code
 * from canonical constructs using UCR syntax patterns.
 */

import type { ParsedConstruct } from "../parsers/parser-adapter.js";

/** Result of code generation. */
export interface GeneratedCode {
  /** Generated source code */
  code: string;
  /** Construct IDs that were successfully mapped to syntax patterns */
  mappedConstructs: string[];
  /** Construct IDs that had no syntax pattern in the target language */
  unmappedConstructs: string[];
}

/** Adapter interface for language-specific code generators. */
export interface GeneratorAdapter {
  /** Target language identifier (matches UCR language_id) */
  readonly languageId: string;

  /** Generate code from parsed canonical constructs. */
  generate(constructs: ParsedConstruct[]): GeneratedCode;
}
