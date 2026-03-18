/**
 * TypeScript AST analyzer using ts.createSourceFile() (parse-only, no type checker).
 * Extracts symbols and relations from TypeScript files syntactically.
 * ~10-100x faster than ts.createProgram() with ~95% accuracy.
 */

import ts from "typescript";
import { readFileSync } from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger.js";
import type { AnalyzedFile, CodeRelation, CodeSymbol } from "./code-types.js";

type PartialSymbol = Omit<CodeSymbol, "id" | "projectId" | "indexedAt">;
type PartialRelation = Omit<CodeRelation, "id" | "projectId" | "indexedAt">;

/**
 * Analyze a single TypeScript file syntactically.
 * Returns extracted symbols and relations with paths relative to basePath.
 */
export function analyzeFile(filePath: string, basePath: string): AnalyzedFile {
  const content = readFileSync(filePath, "utf-8");
  const relativePath = path.relative(basePath, filePath);

  const sourceFile = ts.createSourceFile(
    relativePath,
    content,
    ts.ScriptTarget.Latest,
    true, // setParentNodes
    ts.ScriptKind.TS,
  );

  const symbols: PartialSymbol[] = [];
  const relations: PartialRelation[] = [];

  // Track imports for call resolution: localName → { modulePath, importedName }
  const importMap = new Map<string, { modulePath: string; importedName: string }>();

  // First pass: collect imports
  collectImports(sourceFile, importMap);

  // Second pass: extract symbols and relations
  visitNode(sourceFile, sourceFile, relativePath, symbols, relations, importMap, null);

  logger.debug("ts-analyzer:file", {
    file: relativePath,
    symbols: symbols.length,
    relations: relations.length,
  });

  return { file: relativePath, symbols, relations };
}

// ── Import Collection ────────────────────────────────

function collectImports(
  sourceFile: ts.SourceFile,
  importMap: Map<string, { modulePath: string; importedName: string }>,
): void {
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!stmt.moduleSpecifier || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;

    const modulePath = stmt.moduleSpecifier.text;
    const clause = stmt.importClause;
    if (!clause) continue;

    // Default import
    if (clause.name) {
      importMap.set(clause.name.text, { modulePath, importedName: "default" });
    }

    // Named imports: import { a, b as c } from '...'
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const specifier of clause.namedBindings.elements) {
        const localName = specifier.name.text;
        const importedName = specifier.propertyName?.text ?? localName;
        importMap.set(localName, { modulePath, importedName });
      }
    }

    // Namespace import: import * as ns from '...'
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      importMap.set(clause.namedBindings.name.text, { modulePath, importedName: "*" });
    }
  }
}

// ── AST Visitor ──────────────────────────────────────

function visitNode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  file: string,
  symbols: PartialSymbol[],
  relations: PartialRelation[],
  importMap: Map<string, { modulePath: string; importedName: string }>,
  currentClass: string | null,
): void {
  // Function declarations
  if (ts.isFunctionDeclaration(node) && node.name) {
    const name = node.name.text;
    const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());

    symbols.push({
      name,
      kind: "function",
      file,
      startLine: startLine + 1,
      endLine: endLine + 1,
      exported: hasExportModifier(node),
      signature: extractSignature(node, sourceFile),
    });

    // Scan function body for calls
    if (node.body) {
      collectCalls(node.body, sourceFile, file, name, relations, importMap);
    }
  }

  // Class declarations
  if (ts.isClassDeclaration(node) && node.name) {
    const className = node.name.text;
    const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());

    symbols.push({
      name: className,
      kind: "class",
      file,
      startLine: startLine + 1,
      endLine: endLine + 1,
      exported: hasExportModifier(node),
    });

    // Heritage clauses: extends / implements
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        const relType = clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements";
        for (const typeExpr of clause.types) {
          const baseName = typeExpr.expression.getText(sourceFile);
          relations.push({
            fromSymbol: className,
            toSymbol: baseName,
            type: relType as PartialRelation["type"],
            file,
            line: ts.getLineAndCharacterOfPosition(sourceFile, typeExpr.getStart()).line + 1,
          });
        }
      }
    }

    // Visit class members
    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        const methodName = member.name.getText(sourceFile);
        const { line: mStartLine } = ts.getLineAndCharacterOfPosition(sourceFile, member.getStart());
        const { line: mEndLine } = ts.getLineAndCharacterOfPosition(sourceFile, member.getEnd());

        symbols.push({
          name: methodName,
          kind: "method",
          file,
          startLine: mStartLine + 1,
          endLine: mEndLine + 1,
          exported: false,
          signature: extractSignature(member, sourceFile),
        });

        relations.push({
          fromSymbol: methodName,
          toSymbol: className,
          type: "belongs_to",
          file,
          line: mStartLine + 1,
        });

        // Scan method body for calls
        if (member.body) {
          collectCalls(member.body, sourceFile, file, methodName, relations, importMap);
        }
      }

      if (ts.isConstructorDeclaration(member) && member.body) {
        const { line: cStartLine } = ts.getLineAndCharacterOfPosition(sourceFile, member.getStart());
        const { line: cEndLine } = ts.getLineAndCharacterOfPosition(sourceFile, member.getEnd());

        symbols.push({
          name: "constructor",
          kind: "method",
          file,
          startLine: cStartLine + 1,
          endLine: cEndLine + 1,
          exported: false,
        });

        relations.push({
          fromSymbol: "constructor",
          toSymbol: className,
          type: "belongs_to",
          file,
          line: cStartLine + 1,
        });

        collectCalls(member.body, sourceFile, file, "constructor", relations, importMap);
      }
    }

    return; // Don't recurse into class children again
  }

  // Interface declarations
  if (ts.isInterfaceDeclaration(node)) {
    const name = node.name.text;
    const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());

    symbols.push({
      name,
      kind: "interface",
      file,
      startLine: startLine + 1,
      endLine: endLine + 1,
      exported: hasExportModifier(node),
    });
  }

  // Type alias declarations
  if (ts.isTypeAliasDeclaration(node)) {
    const name = node.name.text;
    const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());

    symbols.push({
      name,
      kind: "type_alias",
      file,
      startLine: startLine + 1,
      endLine: endLine + 1,
      exported: hasExportModifier(node),
    });
  }

  // Enum declarations
  if (ts.isEnumDeclaration(node)) {
    const name = node.name.text;
    const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());

    symbols.push({
      name,
      kind: "enum",
      file,
      startLine: startLine + 1,
      endLine: endLine + 1,
      exported: hasExportModifier(node),
    });
  }

  // Variable statements (top-level exports: export const X = ...)
  if (ts.isVariableStatement(node) && hasExportModifier(node)) {
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) {
        const name = decl.name.text;
        const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
        const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());

        symbols.push({
          name,
          kind: "variable",
          file,
          startLine: startLine + 1,
          endLine: endLine + 1,
          exported: true,
        });
      }
    }
  }

  // Import declarations → import relations (file-level, from each imported name to the file)
  if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    const modulePath = node.moduleSpecifier.text;
    const clause = node.importClause;
    if (clause) {
      const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());

      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const specifier of clause.namedBindings.elements) {
          const importedName = specifier.propertyName?.text ?? specifier.name.text;
          relations.push({
            fromSymbol: file,
            toSymbol: importedName,
            type: "imports",
            file,
            line: line + 1,
            metadata: { modulePath },
          });
        }
      }

      if (clause.name) {
        relations.push({
          fromSymbol: file,
          toSymbol: clause.name.text,
          type: "imports",
          file,
          line: line + 1,
          metadata: { modulePath },
        });
      }
    }
  }

  // Recurse into children (except class which is handled above)
  if (!ts.isClassDeclaration(node)) {
    ts.forEachChild(node, (child) => {
      visitNode(child, sourceFile, file, symbols, relations, importMap, currentClass);
    });
  }
}

// ── Call Collection ──────────────────────────────────

function collectCalls(
  body: ts.Node,
  sourceFile: ts.SourceFile,
  file: string,
  callerName: string,
  relations: PartialRelation[],
  importMap: Map<string, { modulePath: string; importedName: string }>,
): void {
  const seen = new Set<string>();

  function walk(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const calleeName = extractCalleeName(node.expression, sourceFile);
      if (calleeName && calleeName !== callerName && !seen.has(calleeName)) {
        seen.add(calleeName);
        const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());

        // Resolve through import map if available
        const resolvedName = importMap.has(calleeName)
          ? importMap.get(calleeName)!.importedName === "*"
            ? calleeName
            : importMap.get(calleeName)!.importedName
          : calleeName;

        relations.push({
          fromSymbol: callerName,
          toSymbol: resolvedName,
          type: "calls",
          file,
          line: line + 1,
        });
      }
    }

    if (ts.isNewExpression(node)) {
      const calleeName = extractCalleeName(node.expression, sourceFile);
      if (calleeName && !seen.has(calleeName)) {
        seen.add(calleeName);
        const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
        relations.push({
          fromSymbol: callerName,
          toSymbol: calleeName,
          type: "calls",
          file,
          line: line + 1,
        });
      }
    }

    ts.forEachChild(node, walk);
  }

  walk(body);
}

// ── Helpers ──────────────────────────────────────────

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function extractCalleeName(expr: ts.Expression, sourceFile: ts.SourceFile): string | null {
  // Simple identifier: foo()
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }

  // Property access: obj.method() → extract method name
  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.text;
  }

  return null;
}

function extractSignature(
  node: ts.FunctionDeclaration | ts.MethodDeclaration,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!node.parameters || node.parameters.length === 0) return undefined;

  const params = node.parameters
    .map((p) => p.getText(sourceFile))
    .join(", ");

  const returnType = node.type ? `: ${node.type.getText(sourceFile)}` : "";
  return `(${params})${returnType}`;
}
