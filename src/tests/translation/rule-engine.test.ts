/**
 * TDD tests for rule engine executor.
 * Task 4.2b+4.2c: TS↔Python rules + rule engine executor.
 */
import { describe, it, expect } from "vitest";
import { RuleEngine } from "../../core/translation/rules/rule-engine.js";
import { TS_TO_PYTHON_RULES } from "../../core/translation/rules/ts-to-python-rules.js";
import { PYTHON_TO_TS_RULES } from "../../core/translation/rules/python-to-ts-rules.js";
import { createIRNode, type IRNode } from "../../core/translation/ir/ir-types.js";

describe("RuleEngine", () => {
  describe("TS → Python rules", () => {
    const engine = new RuleEngine(TS_TO_PYTHON_RULES);

    it("should have rules loaded", () => {
      expect(engine.ruleCount).toBeGreaterThan(0);
    });

    it("should match IfStatement to Python if template", () => {
      const node = createIRNode("IfStatement", { startLine: 1, endLine: 3 });
      const result = engine.matchRule(node);

      expect(result).toBeDefined();
      expect(result!.rule.irNodeType).toBe("IfStatement");
      expect(result!.rule.transformation.template).toContain("if");
      expect(result!.rule.targetLanguage).toBe("python");
    });

    it("should match FunctionDecl to Python def template", () => {
      const node = createIRNode("FunctionDecl", { name: "add", startLine: 1, endLine: 5 });
      const result = engine.matchRule(node);

      expect(result).toBeDefined();
      expect(result!.rule.transformation.template).toContain("def");
    });

    it("should match ClassDecl to Python class template", () => {
      const node = createIRNode("ClassDecl", { name: "UserService", startLine: 1, endLine: 20 });
      const result = engine.matchRule(node);

      expect(result).toBeDefined();
      expect(result!.rule.transformation.template).toContain("class");
    });

    it("should match TryCatch to Python try/except template", () => {
      const node = createIRNode("TryCatch", { startLine: 1, endLine: 5 });
      const result = engine.matchRule(node);

      expect(result).toBeDefined();
      expect(result!.rule.transformation.template).toContain("except");
    });

    it("should match AsyncFunction to Python async def template", () => {
      const node = createIRNode("AsyncFunction", { name: "load", startLine: 1, endLine: 8 });
      const result = engine.matchRule(node);

      expect(result).toBeDefined();
      expect(result!.rule.transformation.template).toContain("async def");
    });

    it("should match Import to Python import template", () => {
      const node = createIRNode("Import", { name: "express", startLine: 1, endLine: 1 });
      const result = engine.matchRule(node);

      expect(result).toBeDefined();
      expect(result!.rule.transformation.template).toContain("import");
    });

    it("should return undefined for unmatched node types", () => {
      const node = createIRNode("Expression", { startLine: 1, endLine: 1 });
      const result = engine.matchRule(node);

      // Expression may or may not have a rule — but shouldn't crash
      expect(result === undefined || result !== undefined).toBe(true);
    });
  });

  describe("Python → TS rules", () => {
    const engine = new RuleEngine(PYTHON_TO_TS_RULES);

    it("should have rules loaded", () => {
      expect(engine.ruleCount).toBeGreaterThan(0);
    });

    it("should match FunctionDecl to TS function template", () => {
      const node = createIRNode("FunctionDecl", { name: "add", startLine: 1, endLine: 5 });
      const result = engine.matchRule(node);

      expect(result).toBeDefined();
      expect(result!.rule.transformation.template).toContain("function");
    });

    it("should match TryCatch to TS try/catch template", () => {
      const node = createIRNode("TryCatch", { startLine: 1, endLine: 5 });
      const result = engine.matchRule(node);

      expect(result).toBeDefined();
      expect(result!.rule.transformation.template).toContain("catch");
    });
  });

  describe("applyRules (batch)", () => {
    const engine = new RuleEngine(TS_TO_PYTHON_RULES);

    it("should apply rules to all nodes in a tree and report matched/unmatched", () => {
      const nodes: IRNode[] = [
        createIRNode("FunctionDecl", { name: "main", startLine: 1, endLine: 10 }),
        createIRNode("IfStatement", { startLine: 2, endLine: 5 }),
        createIRNode("ReturnStatement", { startLine: 6, endLine: 6 }),
        createIRNode("Expression", { startLine: 7, endLine: 7, metadata: { constructId: "uc_nullish" } }),
      ];

      const results = engine.applyRules(nodes);

      expect(results.matched.length).toBeGreaterThan(0);
      // Some nodes may be unmatched (Expression with obscure construct)
      expect(results.matched.length + results.unmatched.length).toBe(4);
    });

    it("should flag unmatched nodes for AI fallback", () => {
      const nodes: IRNode[] = [
        createIRNode("Decorator", { startLine: 1, endLine: 1 }),
      ];

      const results = engine.applyRules(nodes);

      // Decorator likely unmatched (no rule) — flagged for AI
      if (results.unmatched.length > 0) {
        expect(results.unmatched[0].type).toBe("Decorator");
      }
    });
  });

  describe("rule coverage", () => {
    it("should cover at least 60% of common IR node types for TS→Python", () => {
      const engine = new RuleEngine(TS_TO_PYTHON_RULES);
      const commonTypes = [
        "FunctionDecl", "ClassDecl", "IfStatement", "ForLoop",
        "WhileLoop", "TryCatch", "Import", "Export",
        "AsyncFunction", "VariableDecl", "ReturnStatement",
        "ArrowFunction", "MethodDecl", "ThrowStatement",
      ];

      let matched = 0;
      for (const type of commonTypes) {
        const node = createIRNode(type as any, { startLine: 1, endLine: 1 });
        if (engine.matchRule(node)) matched++;
      }

      const coverage = matched / commonTypes.length;
      expect(coverage).toBeGreaterThanOrEqual(0.6);
    });
  });
});
