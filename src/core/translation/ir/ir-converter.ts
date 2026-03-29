/**
 * IR Converter — converts ParsedConstruct[] from parser adapters to IR tree.
 *
 * Maps UCR construct IDs to language-agnostic IRNodeType values.
 * Unknown constructs fall back to "Expression" type.
 */

import type { ParsedConstruct } from "../parsers/parser-adapter.js";
import { createIRNode, createIRTree, type IRNode, type IRNodeType } from "./ir-types.js";

// ── UCR → IR Mapping ──────────────────────────────

/** Maps UCR construct ID prefixes/names to IR node types. */
const CONSTRUCT_TO_IR: Record<string, IRNodeType> = {
  // Functions
  uc_fn_def: "FunctionDecl",
  uc_fn_call: "Expression",
  uc_arrow_fn: "ArrowFunction",
  uc_method_def: "MethodDecl",
  uc_constructor: "MethodDecl",
  uc_getter: "MethodDecl",
  uc_setter: "MethodDecl",
  uc_generator: "FunctionDecl",
  uc_default_param: "Expression",
  uc_rest_param: "Expression",

  // Async
  uc_async_fn: "AsyncFunction",
  uc_await: "AwaitExpr",
  uc_promise_all: "Expression",

  // Classes
  uc_class_def: "ClassDecl",
  uc_interface: "InterfaceDecl",
  uc_abstract_class: "ClassDecl",
  uc_extends: "Expression",
  uc_implements: "Expression",
  uc_property: "PropertyDecl",
  uc_static_method: "MethodDecl",

  // Control flow
  uc_if_else: "IfStatement",
  uc_ternary: "Expression",
  uc_switch: "SwitchCase",
  uc_for_loop: "ForLoop",
  uc_for_each: "ForLoop",
  uc_while: "WhileLoop",
  uc_do_while: "WhileLoop",
  uc_break: "Expression",
  uc_continue: "Expression",
  uc_return: "ReturnStatement",

  // Error handling
  uc_try_catch: "TryCatch",
  uc_try_finally: "TryCatch",
  uc_throw: "ThrowStatement",

  // Modules
  uc_import_named: "Import",
  uc_import_default: "Import",
  uc_import_namespace: "Import",
  uc_export_named: "Export",
  uc_export_default: "Export",

  // Decorators & types
  uc_type_alias: "TypeAnnotation",
  uc_type_enum: "TypeAnnotation",
  uc_type_generic: "TypeAnnotation",

  // Variables
  uc_const_decl: "VariableDecl",
  uc_let_decl: "VariableDecl",
  uc_var_decl: "VariableDecl",
  uc_assign: "Expression",

  // Collections (map to Expression — they are method calls)
  uc_arr_map: "Expression",
  uc_arr_filter: "Expression",
  uc_arr_reduce: "Expression",
  uc_arr_push: "Expression",
  uc_arr_includes: "Expression",
  uc_obj_keys: "Expression",

  // Operators
  uc_nullish: "Expression",
  uc_optional_chain: "Expression",
  uc_spread: "Expression",
  uc_destruct_obj: "Expression",
  uc_destruct_arr: "Expression",
  uc_template_lit: "Expression",
};

// ── Converter ──────────────────────────────────────

/**
 * Resolve IR node type from UCR construct ID.
 * Falls back to "Expression" for unknown constructs.
 */
function resolveIRType(constructId: string): IRNodeType {
  return CONSTRUCT_TO_IR[constructId] ?? "Expression";
}

/**
 * Convert an array of ParsedConstruct (from any parser adapter) into an IR tree.
 *
 * Each construct becomes a flat child of the Program root.
 * Nesting (e.g., function containing if-statements) is handled
 * separately by the IR builder in task 4.1b.
 */
export function convertToIR(constructs: ParsedConstruct[]): IRNode {
  const nodes = constructs.map((c) =>
    createIRNode(resolveIRType(c.constructId), {
      name: c.name,
      startLine: c.startLine,
      endLine: c.endLine,
      metadata: { constructId: c.constructId },
    }),
  );

  return createIRTree(nodes);
}
