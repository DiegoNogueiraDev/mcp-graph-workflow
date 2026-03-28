/**
 * Parser Adapter interface — language-agnostic contract for parsing code into
 * canonical constructs from the UCR (Universal Construct Registry).
 */

/** A construct detected in source code, mapped to a UCR canonical ID. */
export interface ParsedConstruct {
  /** UCR canonical construct ID (e.g., "uc_fn_def", "uc_class_def") */
  constructId: string;
  /** Name of the construct if applicable (function name, class name, etc.) */
  name?: string;
  /** 1-based start line in source */
  startLine: number;
  /** 1-based end line in source */
  endLine: number;
}

/** Adapter interface for language-specific parsers. */
export interface ParserAdapter {
  /** Language identifier (matches UCR language_id, e.g., "typescript", "python") */
  readonly languageId: string;

  /** Parse a code snippet and return detected canonical constructs. */
  parseSnippet(code: string): ParsedConstruct[];
}
