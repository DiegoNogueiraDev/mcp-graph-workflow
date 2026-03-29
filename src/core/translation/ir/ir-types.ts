/**
 * IR (Intermediate Representation) — language-agnostic canonical node types.
 *
 * Represents code constructs in a language-neutral form for translation.
 * Maps 1:1 with UCR canonical construct categories but uses simplified
 * node types for tree representation.
 *
 * Design principles:
 * - Language-agnostic: no TS-specific or Python-specific naming
 * - Tree-structured: parent/child relationships via children[]
 * - Metadata-extensible: constructId, sourceLanguage, etc.
 * - Compatible with existing UCR construct IDs
 */

import { generateId } from "../../utils/id.js";

// ── IR Node Types ──────────────────────────────────

/** All supported IR node types (language-agnostic). */
export type IRNodeType =
  // Program root
  | "Program"
  | "Block"
  // Functions
  | "FunctionDecl"
  | "ArrowFunction"
  | "MethodDecl"
  | "AsyncFunction"
  // Classes & interfaces
  | "ClassDecl"
  | "InterfaceDecl"
  | "PropertyDecl"
  // Control flow
  | "IfStatement"
  | "SwitchCase"
  | "ForLoop"
  | "WhileLoop"
  | "ReturnStatement"
  // Error handling
  | "TryCatch"
  | "ThrowStatement"
  // Modules
  | "Import"
  | "Export"
  // Async
  | "AwaitExpr"
  // Decorators & types
  | "Decorator"
  | "TypeAnnotation"
  // Variables
  | "VariableDecl"
  // Generic
  | "Expression";

// ── IR Node Interface ──────────────────────────────

export interface IRNode {
  /** Unique identifier for this IR node. */
  id: string;
  /** Language-agnostic node type. */
  type: IRNodeType;
  /** Name of the construct (function name, class name, import path, etc.). */
  name?: string;
  /** Source code start line (1-based). */
  startLine: number;
  /** Source code end line (1-based). */
  endLine: number;
  /** Original source text for this construct. */
  sourceText?: string;
  /** Child nodes (nested constructs). */
  children: IRNode[];
  /** Extensible metadata (constructId, sourceLanguage, isAsync, etc.). */
  metadata?: Record<string, unknown>;
}

// ── Factory Functions ──────────────────────────────

export interface CreateIRNodeOptions {
  name?: string;
  startLine: number;
  endLine: number;
  sourceText?: string;
  children?: IRNode[];
  metadata?: Record<string, unknown>;
}

/**
 * Create a new IR node with a unique ID.
 */
export function createIRNode(type: IRNodeType, options: CreateIRNodeOptions): IRNode {
  return {
    id: generateId("ir"),
    type,
    name: options.name,
    startLine: options.startLine,
    endLine: options.endLine,
    sourceText: options.sourceText,
    children: options.children ?? [],
    metadata: options.metadata,
  };
}

/**
 * Create a Program root node from a list of top-level IR nodes.
 */
export function createIRTree(nodes: IRNode[]): IRNode {
  const startLine = nodes.length > 0 ? Math.min(...nodes.map((n) => n.startLine)) : 1;
  const endLine = nodes.length > 0 ? Math.max(...nodes.map((n) => n.endLine)) : 1;

  return createIRNode("Program", {
    startLine,
    endLine,
    children: nodes,
  });
}
