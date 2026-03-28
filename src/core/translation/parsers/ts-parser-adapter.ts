/**
 * TypeScript Parser Adapter — parses TS/JS code into UCR canonical constructs
 * using the TypeScript compiler API (ts.createSourceFile + AST walk).
 */

import ts from "typescript";
import type { ParserAdapter, ParsedConstruct } from "./parser-adapter.js";

export class TsParserAdapter implements ParserAdapter {
  readonly languageId = "typescript";

  parseSnippet(code: string): ParsedConstruct[] {
    if (!code.trim()) return [];

    const sourceFile = ts.createSourceFile("snippet.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const constructs: ParsedConstruct[] = [];

    const visit = (node: ts.Node): void => {
      const mapped = mapNode(node, sourceFile);
      if (mapped) constructs.push(...mapped);
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return constructs;
  }
}

function getLines(node: ts.Node, sf: ts.SourceFile): { startLine: number; endLine: number } {
  const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const end = sf.getLineAndCharacterOfPosition(node.getEnd());
  return { startLine: start.line + 1, endLine: end.line + 1 };
}

function mapNode(node: ts.Node, sf: ts.SourceFile): ParsedConstruct[] | null {
  const lines = getLines(node, sf);

  // Function declaration
  if (ts.isFunctionDeclaration(node) && node.name) {
    const results: ParsedConstruct[] = [{ constructId: "uc_fn_def", name: node.name.text, ...lines }];
    if (hasAsyncModifier(node)) {
      results.push({ constructId: "uc_async_fn", name: node.name.text, ...lines });
    }
    return results;
  }

  // Arrow function (const x = (...) => ...)
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer)) {
    const name = ts.isIdentifier(node.name) ? node.name.text : undefined;
    return [{ constructId: "uc_arrow_fn", name, ...lines }];
  }

  // Class declaration
  if (ts.isClassDeclaration(node) && node.name) {
    const results: ParsedConstruct[] = [{ constructId: "uc_class_def", name: node.name.text, ...lines }];
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          results.push({ constructId: "uc_extends", ...lines });
        }
        if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          results.push({ constructId: "uc_implements", ...lines });
        }
      }
    }
    return results;
  }

  // Interface declaration
  if (ts.isInterfaceDeclaration(node)) {
    return [{ constructId: "uc_interface", name: node.name.text, ...lines }];
  }

  // Type alias
  if (ts.isTypeAliasDeclaration(node)) {
    return [{ constructId: "uc_type_alias", name: node.name.text, ...lines }];
  }

  // Enum declaration
  if (ts.isEnumDeclaration(node)) {
    return [{ constructId: "uc_type_enum", name: node.name.text, ...lines }];
  }

  // Import declaration
  if (ts.isImportDeclaration(node) && node.importClause) {
    const results: ParsedConstruct[] = [];
    const clause = node.importClause;
    if (clause.name) {
      results.push({ constructId: "uc_import_default", ...lines });
    }
    if (clause.namedBindings) {
      if (ts.isNamedImports(clause.namedBindings)) {
        results.push({ constructId: "uc_import_named", ...lines });
      }
      if (ts.isNamespaceImport(clause.namedBindings)) {
        results.push({ constructId: "uc_import_namespace", ...lines });
      }
    }
    return results.length > 0 ? results : null;
  }

  // If statement
  if (ts.isIfStatement(node)) {
    return [{ constructId: "uc_if_else", ...lines }];
  }

  // For statement
  if (ts.isForStatement(node)) {
    return [{ constructId: "uc_for_loop", ...lines }];
  }

  // ForOf / ForIn
  if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
    return [{ constructId: "uc_for_each", ...lines }];
  }

  // While
  if (ts.isWhileStatement(node)) {
    return [{ constructId: "uc_while", ...lines }];
  }

  // Do/While
  if (ts.isDoStatement(node)) {
    return [{ constructId: "uc_do_while", ...lines }];
  }

  // Try/Catch
  if (ts.isTryStatement(node)) {
    const results: ParsedConstruct[] = [{ constructId: "uc_try_catch", ...lines }];
    if (node.finallyBlock) {
      results.push({ constructId: "uc_try_finally", ...lines });
    }
    return results;
  }

  // Switch
  if (ts.isSwitchStatement(node)) {
    return [{ constructId: "uc_switch", ...lines }];
  }

  // Throw
  if (ts.isThrowStatement(node)) {
    return [{ constructId: "uc_throw", ...lines }];
  }

  // Return
  if (ts.isReturnStatement(node)) {
    return [{ constructId: "uc_return", ...lines }];
  }

  // Await expression
  if (ts.isAwaitExpression(node)) {
    return [{ constructId: "uc_await", ...lines }];
  }

  // Export (named)
  if (ts.isExportDeclaration(node)) {
    return [{ constructId: "uc_export_named", ...lines }];
  }

  // Export default
  if (ts.isExportAssignment(node)) {
    return [{ constructId: "uc_export_default", ...lines }];
  }

  return null;
}

function hasAsyncModifier(node: ts.FunctionDeclaration): boolean {
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
}
