/**
 * TDD tests for IR (Intermediate Representation) node types.
 * Task 4.1a: Define IR node types and base interfaces.
 */
import { describe, it, expect } from "vitest";
import {
  createIRNode,
  createIRTree,
  type IRNode,
  type IRNodeType,
} from "../../core/translation/ir/ir-types.js";

describe("IR Node Types", () => {
  describe("createIRNode", () => {
    it("should create a function declaration IR node", () => {
      const node = createIRNode("FunctionDecl", {
        name: "fetchUser",
        startLine: 1,
        endLine: 10,
      });

      expect(node.type).toBe("FunctionDecl");
      expect(node.name).toBe("fetchUser");
      expect(node.startLine).toBe(1);
      expect(node.endLine).toBe(10);
      expect(node.children).toEqual([]);
      expect(node.id).toBeDefined();
    });

    it("should create a class declaration IR node", () => {
      const node = createIRNode("ClassDecl", {
        name: "UserService",
        startLine: 5,
        endLine: 50,
      });

      expect(node.type).toBe("ClassDecl");
      expect(node.name).toBe("UserService");
    });

    it("should create all required IR node types", () => {
      const types: IRNodeType[] = [
        "FunctionDecl", "ClassDecl", "IfStatement", "ForLoop",
        "WhileLoop", "TryCatch", "Import", "Export",
        "AsyncFunction", "AwaitExpr", "Decorator",
        "TypeAnnotation", "VariableDecl", "ReturnStatement",
        "ThrowStatement", "SwitchCase", "ArrowFunction",
        "MethodDecl", "PropertyDecl", "InterfaceDecl",
        "Expression", "Block", "Program",
      ];

      for (const type of types) {
        const node = createIRNode(type, { startLine: 1, endLine: 1 });
        expect(node.type).toBe(type);
      }
    });

    it("should generate unique IDs for each node", () => {
      const node1 = createIRNode("FunctionDecl", { startLine: 1, endLine: 5 });
      const node2 = createIRNode("FunctionDecl", { startLine: 1, endLine: 5 });

      expect(node1.id).not.toBe(node2.id);
    });

    it("should accept optional metadata", () => {
      const node = createIRNode("FunctionDecl", {
        name: "test",
        startLine: 1,
        endLine: 5,
        metadata: { isAsync: true, constructId: "uc_async_fn" },
      });

      expect(node.metadata?.isAsync).toBe(true);
      expect(node.metadata?.constructId).toBe("uc_async_fn");
    });

    it("should accept optional sourceText", () => {
      const node = createIRNode("IfStatement", {
        startLine: 3,
        endLine: 7,
        sourceText: "if (x > 0) { return x; }",
      });

      expect(node.sourceText).toBe("if (x > 0) { return x; }");
    });
  });

  describe("IR tree structure", () => {
    it("should build a tree with parent/child relationships", () => {
      const program = createIRNode("Program", { startLine: 1, endLine: 20 });
      const func = createIRNode("FunctionDecl", { name: "main", startLine: 1, endLine: 10 });
      const ifStmt = createIRNode("IfStatement", { startLine: 2, endLine: 5 });
      const returnStmt = createIRNode("ReturnStatement", { startLine: 3, endLine: 3 });

      // Build tree
      ifStmt.children.push(returnStmt);
      func.children.push(ifStmt);
      program.children.push(func);

      expect(program.children).toHaveLength(1);
      expect(program.children[0].type).toBe("FunctionDecl");
      expect(program.children[0].children[0].type).toBe("IfStatement");
      expect(program.children[0].children[0].children[0].type).toBe("ReturnStatement");
    });

    it("should create an IR tree from flat node list with createIRTree", () => {
      const nodes: IRNode[] = [
        createIRNode("FunctionDecl", { name: "a", startLine: 1, endLine: 10 }),
        createIRNode("FunctionDecl", { name: "b", startLine: 12, endLine: 20 }),
        createIRNode("ClassDecl", { name: "C", startLine: 22, endLine: 40 }),
      ];

      const tree = createIRTree(nodes);

      expect(tree.type).toBe("Program");
      expect(tree.children).toHaveLength(3);
      expect(tree.children[0].name).toBe("a");
      expect(tree.children[1].name).toBe("b");
      expect(tree.children[2].name).toBe("C");
    });
  });

  describe("language-agnostic invariants", () => {
    it("should not contain language-specific AST node type names", () => {
      // IR types should be generic, not tied to TS or Python AST
      const node = createIRNode("FunctionDecl", { name: "test", startLine: 1, endLine: 5 });

      // The node type should be "FunctionDecl", not "FunctionDeclaration" (TS) or "def" (Python)
      expect(node.type).not.toContain("Declaration"); // TS-specific
      expect(node.type).not.toContain("def"); // Python-specific
    });

    it("should have consistent IR node shape regardless of source language", () => {
      // Same construct from TS and Python should produce same IR shape
      const tsFunc = createIRNode("FunctionDecl", {
        name: "add",
        startLine: 1,
        endLine: 3,
        metadata: { sourceLanguage: "typescript" },
      });

      const pyFunc = createIRNode("FunctionDecl", {
        name: "add",
        startLine: 1,
        endLine: 3,
        metadata: { sourceLanguage: "python" },
      });

      // Same shape
      expect(tsFunc.type).toBe(pyFunc.type);
      expect(Object.keys(tsFunc)).toEqual(Object.keys(pyFunc));
    });
  });
});
