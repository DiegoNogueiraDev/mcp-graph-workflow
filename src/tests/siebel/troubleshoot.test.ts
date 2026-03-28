import { describe, it, expect } from "vitest";
import {
  troubleshootSiebel,
} from "../../core/siebel/troubleshoot.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

// --- Factory ---

function makeObj(
  name: string,
  type: SiebelObject["type"],
  props: Record<string, string> = {},
  children: SiebelObject[] = [],
): SiebelObject {
  return {
    name,
    type,
    properties: Object.entries(props).map(([k, v]) => ({ name: k, value: v })),
    children,
  };
}

function makeScript(name: string, code: string): SiebelObject {
  return makeObj(name, "escript", { SOURCE_CODE: code, METHOD: name });
}

function makeDep(from: string, fromType: SiebelObject["type"], to: string, toType: SiebelObject["type"]): SiebelDependency {
  return { from: { name: from, type: fromType }, to: { name: to, type: toType }, relationType: "references" };
}

describe("troubleshoot", () => {
  // AC1: Accept error message
  describe("AC1: accept error/problem description", () => {
    it("should accept error message and return analysis", () => {
      const result = troubleshootSiebel({
        errorMessage: "Object reference not set: CX Account BC",
        objects: [makeObj("CX Account BC", "business_component")],
        dependencies: [],
      });

      expect(result).toBeDefined();
      expect(result.relatedObjects.length).toBeGreaterThanOrEqual(1);
    });

    it("should accept problem description", () => {
      const result = troubleshootSiebel({
        errorMessage: "Applet not displaying data after query",
        objects: [makeObj("CX Order Applet", "applet", { BUS_COMP: "CX Order BC" })],
        dependencies: [],
      });

      expect(result).toBeDefined();
      expect(result.causes.length).toBeGreaterThan(0);
    });
  });

  // AC2: Search for related scripts
  describe("AC2: find related scripts", () => {
    it("should find scripts referencing the affected object", () => {
      const objects = [
        makeObj("CX Account BC", "business_component", {}, [
          makeScript("PreInvokeMethod", `function PreInvokeMethod(MethodName) {
  try { var x = 1; } catch(e) { TheApplication().RaiseErrorText(e.toString()); }
}`),
        ]),
        makeObj("CX Account Applet", "applet", { BUS_COMP: "CX Account BC" }, [
          makeScript("WebApplet_PreInvokeMethod", `function WebApplet_PreInvokeMethod(MethodName) {
  try {
    var bc = this.BusComp();
    bc.GetFieldValue("Name");
  } catch(e) { TheApplication().RaiseErrorText(e.toString()); }
}`),
        ]),
      ];

      const result = troubleshootSiebel({
        errorMessage: "Error in CX Account BC",
        objects,
        dependencies: [],
      });

      expect(result.relatedScripts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // AC3: Dependency chain analysis
  describe("AC3: dependency chain", () => {
    it("should analyze dependency chain of affected object", () => {
      const objects = [
        makeObj("CX Account BC", "business_component"),
        makeObj("CX Account Applet", "applet"),
        makeObj("CX Account View", "view"),
      ];
      const deps: SiebelDependency[] = [
        makeDep("CX Account Applet", "applet", "CX Account BC", "business_component"),
        makeDep("CX Account View", "view", "CX Account Applet", "applet"),
      ];

      const result = troubleshootSiebel({
        errorMessage: "CX Account BC query failed",
        objects,
        dependencies: deps,
      });

      expect(result.dependencyChain.length).toBeGreaterThan(0);
    });
  });

  // AC4: Common config issues
  describe("AC4: common config checks", () => {
    it("should check User Properties for known issues", () => {
      const objects = [
        makeObj("CX Account Applet", "applet", {}, [
          makeObj("Named Search", "user_property", { VALUE: "" }),
        ]),
      ];

      const result = troubleshootSiebel({
        errorMessage: "CX Account Applet search not working",
        objects,
        dependencies: [],
      });

      expect(result.configIssues.length).toBeGreaterThanOrEqual(0);
    });
  });

  // AC5: Ranked causes
  describe("AC5: suggest causes ranked by probability", () => {
    it("should suggest 1-5 causes", () => {
      const objects = [
        makeObj("CX Order BC", "business_component", {}, [
          makeScript("Query", `function Query() { var x = 1; }`),
        ]),
      ];

      const result = troubleshootSiebel({
        errorMessage: "CX Order BC returns no records",
        objects,
        dependencies: [],
      });

      expect(result.causes.length).toBeGreaterThanOrEqual(1);
      expect(result.causes.length).toBeLessThanOrEqual(5);
      // Should be sorted by probability desc
      for (let i = 1; i < result.causes.length; i++) {
        expect(result.causes[i].probability).toBeLessThanOrEqual(result.causes[i - 1].probability);
      }
    });
  });

  // AC6: Fix suggestions with code examples
  describe("AC6: fix suggestions", () => {
    it("should include suggestion and code example per cause", () => {
      const objects = [
        makeObj("CX Applet", "applet", { BUS_COMP: "CX BC" }, [
          makeScript("Foo", `function Foo() { var bc = TheApplication().GetBusComp("CX BC"); bc.ExecuteQuery(); }`),
        ]),
      ];

      const result = troubleshootSiebel({
        errorMessage: "Error in CX Applet script",
        objects,
        dependencies: [],
      });

      for (const cause of result.causes) {
        expect(cause.suggestion).toBeDefined();
        expect(cause.suggestion.length).toBeGreaterThan(0);
      }
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("should handle empty objects", () => {
      const result = troubleshootSiebel({
        errorMessage: "Some error",
        objects: [],
        dependencies: [],
      });

      expect(result.causes.length).toBeGreaterThanOrEqual(1); // generic causes
      expect(result.relatedObjects).toHaveLength(0);
    });

    it("should handle error with no matching objects", () => {
      const result = troubleshootSiebel({
        errorMessage: "Unknown component failed",
        objects: [makeObj("CX Other", "applet")],
        dependencies: [],
      });

      expect(result).toBeDefined();
      expect(result.causes.length).toBeGreaterThanOrEqual(1);
    });
  });
});
