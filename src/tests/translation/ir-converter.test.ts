/**
 * TDD tests for TS-to-IR and Python-to-IR converters.
 * Task 4.1c: Tests for conversion with real snippets.
 */
import { describe, it, expect } from "vitest";
import { convertToIR } from "../../core/translation/ir/ir-converter.js";
import type { ParsedConstruct } from "../../core/translation/parsers/parser-adapter.js";

describe("IR Converter", () => {
  describe("convertToIR from ParsedConstruct[]", () => {
    it("should convert a function construct to FunctionDecl IR node", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "fetchUser", startLine: 1, endLine: 10 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.type).toBe("Program");
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0].type).toBe("FunctionDecl");
      expect(tree.children[0].name).toBe("fetchUser");
      expect(tree.children[0].metadata?.constructId).toBe("uc_fn_def");
    });

    it("should convert a class construct to ClassDecl IR node", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_class_def", name: "UserService", startLine: 1, endLine: 50 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("ClassDecl");
      expect(tree.children[0].name).toBe("UserService");
    });

    it("should convert control flow constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_if_else", startLine: 2, endLine: 5 },
        { constructId: "uc_for_loop", startLine: 7, endLine: 9 },
        { constructId: "uc_while", startLine: 11, endLine: 14 },
        { constructId: "uc_switch", startLine: 16, endLine: 20 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("IfStatement");
      expect(tree.children[1].type).toBe("ForLoop");
      expect(tree.children[2].type).toBe("WhileLoop");
      expect(tree.children[3].type).toBe("SwitchCase");
    });

    it("should convert error handling constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_try_catch", startLine: 1, endLine: 5 },
        { constructId: "uc_throw", startLine: 3, endLine: 3 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("TryCatch");
      expect(tree.children[1].type).toBe("ThrowStatement");
    });

    it("should convert async constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_async_fn", name: "loadData", startLine: 1, endLine: 8 },
        { constructId: "uc_await", startLine: 3, endLine: 3 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("AsyncFunction");
      expect(tree.children[0].name).toBe("loadData");
      expect(tree.children[1].type).toBe("AwaitExpr");
    });

    it("should convert import/export constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_import_named", name: "express", startLine: 1, endLine: 1 },
        { constructId: "uc_export_named", name: "handler", startLine: 10, endLine: 10 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("Import");
      expect(tree.children[0].name).toBe("express");
      expect(tree.children[1].type).toBe("Export");
    });

    it("should convert variable and return constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_const_decl", name: "x", startLine: 1, endLine: 1 },
        { constructId: "uc_return", startLine: 5, endLine: 5 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("VariableDecl");
      expect(tree.children[1].type).toBe("ReturnStatement");
    });

    it("should convert arrow function and method constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_arrow_fn", name: "cb", startLine: 1, endLine: 3 },
        { constructId: "uc_method_def", name: "process", startLine: 5, endLine: 10 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("ArrowFunction");
      expect(tree.children[1].type).toBe("MethodDecl");
    });

    it("should convert class-related constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_interface", name: "IUser", startLine: 1, endLine: 5 },
        { constructId: "uc_property", name: "name", startLine: 2, endLine: 2 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("InterfaceDecl");
      expect(tree.children[1].type).toBe("PropertyDecl");
    });

    it("should fallback unknown construct IDs to Expression", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_unknown_xyz", startLine: 1, endLine: 1 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.children[0].type).toBe("Expression");
      expect(tree.children[0].metadata?.constructId).toBe("uc_unknown_xyz");
    });

    it("should handle empty construct list", () => {
      const tree = convertToIR([]);

      expect(tree.type).toBe("Program");
      expect(tree.children).toHaveLength(0);
    });
  });

  describe("TS snippet conversion (end-to-end)", () => {
    it("should convert a realistic TS ParsedConstruct set", () => {
      // Simulates what ts-parser-adapter produces for a typical snippet
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_import_named", name: "express", startLine: 1, endLine: 1 },
        { constructId: "uc_async_fn", name: "getUser", startLine: 3, endLine: 12 },
        { constructId: "uc_fn_def", name: "getUser", startLine: 3, endLine: 12 },
        { constructId: "uc_try_catch", startLine: 4, endLine: 11 },
        { constructId: "uc_await", startLine: 5, endLine: 5 },
        { constructId: "uc_return", startLine: 6, endLine: 6 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.type).toBe("Program");
      expect(tree.children.length).toBeGreaterThanOrEqual(5);

      const types = tree.children.map((c) => c.type);
      expect(types).toContain("Import");
      expect(types).toContain("AsyncFunction");
      expect(types).toContain("FunctionDecl");
      expect(types).toContain("TryCatch");
      expect(types).toContain("AwaitExpr");
    });
  });

  describe("Python snippet conversion (end-to-end)", () => {
    it("should convert a realistic Python ParsedConstruct set", () => {
      // Simulates what python-parser-adapter produces
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_import_named", name: "requests", startLine: 1, endLine: 1 },
        { constructId: "uc_async_fn", name: "fetch_data", startLine: 3, endLine: 10 },
        { constructId: "uc_fn_def", name: "fetch_data", startLine: 3, endLine: 10 },
        { constructId: "uc_try_catch", startLine: 4, endLine: 9 },
        { constructId: "uc_await", startLine: 5, endLine: 5 },
      ];

      const tree = convertToIR(constructs);

      expect(tree.type).toBe("Program");
      const types = tree.children.map((c) => c.type);
      expect(types).toContain("Import");
      expect(types).toContain("AsyncFunction");
      expect(types).toContain("TryCatch");
    });
  });
});
