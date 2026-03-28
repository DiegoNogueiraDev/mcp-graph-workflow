import { describe, it, expect } from "vitest";
import {
  reviewSiebelCode,
} from "../../core/siebel/code-review.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

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
    inactive: false,
  };
}

function makeScript(name: string, sourceCode: string): SiebelObject {
  return makeObj(name, "escript", { SOURCE_CODE: sourceCode, METHOD: name });
}

describe("code-review", () => {
  // AC1: Naming conventions
  describe("AC1: naming conventions", () => {
    it("should flag objects without required prefix", () => {
      const objects = [makeObj("Account List Applet", "applet")];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      expect(result.issues.some((i) => i.category === "naming" && i.objectName === "Account List Applet")).toBe(true);
    });

    it("should pass objects with correct prefix", () => {
      const objects = [makeObj("CX_Account List Applet", "applet")];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      const namingIssues = result.issues.filter(
        (i) => i.category === "naming" && i.objectName === "CX_Account List Applet",
      );
      expect(namingIssues).toHaveLength(0);
    });

    it("should support multiple prefixes", () => {
      const objects = [
        makeObj("AC_Order Applet", "applet"),
        makeObj("Bad Order Applet", "applet"),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_", allowedPrefixes: ["CX_", "AC_"] });

      const namingIssues = result.issues.filter((i) => i.category === "naming");
      expect(namingIssues).toHaveLength(1);
      expect(namingIssues[0].objectName).toBe("Bad Order Applet");
    });
  });

  // AC2: Event handlers with try/catch/finally
  describe("AC2: try/catch/finally in scripts", () => {
    it("should flag scripts without try/catch", () => {
      const objects = [
        makeObj("CX_Applet", "applet", {}, [
          makeScript("PreInvokeMethod", `function PreInvokeMethod(MethodName) {
  var x = 1;
  return CancelOperation;
}`),
        ]),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      expect(result.issues.some((i) => i.category === "error_handling")).toBe(true);
    });

    it("should not flag scripts with try/catch", () => {
      const objects = [
        makeObj("CX_Applet", "applet", {}, [
          makeScript("PreInvokeMethod", `function PreInvokeMethod(MethodName) {
  try {
    var x = 1;
  } catch(e) {
    TheApplication().RaiseErrorText(e.toString());
  } finally {
    x = null;
  }
}`),
        ]),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      const errorIssues = result.issues.filter((i) => i.category === "error_handling");
      expect(errorIssues).toHaveLength(0);
    });
  });

  // AC3: Hardcoded values
  describe("AC3: hardcoded values", () => {
    it("should detect hardcoded URLs in scripts", () => {
      const objects = [
        makeObj("CX_Applet", "applet", {}, [
          makeScript("Foo", `function Foo() {
  try {
    var url = "http://prod-server.example.com/api";
  } catch(e) { TheApplication().RaiseErrorText(e.toString()); }
}`),
        ]),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      expect(result.issues.some((i) => i.category === "hardcoded_values")).toBe(true);
    });

    it("should detect hardcoded environment names", () => {
      const objects = [
        makeObj("CX_Applet", "applet", {}, [
          makeScript("Foo", `function Foo() {
  try {
    var env = "PROD_SERVER_01";
  } catch(e) { TheApplication().RaiseErrorText(e.toString()); }
}`),
        ]),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      expect(result.issues.some((i) => i.category === "hardcoded_values")).toBe(true);
    });
  });

  // AC4: Field references in BC
  describe("AC4: field references validation", () => {
    it("should flag GetFieldValue for unknown fields when BC fields are provided", () => {
      const bc = makeObj("CX_Account BC", "business_component", {}, [
        makeObj("Name", "field"),
        makeObj("Status", "field"),
      ]);
      const applet = makeObj("CX_Account Applet", "applet", { BUS_COMP: "CX_Account BC" }, [
        makeScript("Foo", `function Foo() {
  try {
    var val = bc.GetFieldValue("NonExistentField");
  } catch(e) { TheApplication().RaiseErrorText(e.toString()); }
}`),
      ]);
      const result = reviewSiebelCode([bc, applet], { prefix: "CX_" });

      expect(result.issues.some((i) => i.category === "field_reference" && i.detail.includes("NonExistentField"))).toBe(true);
    });
  });

  // AC5: ProfileAttr usage
  describe("AC5: ProfileAttr tracking", () => {
    it("should flag SetProfileAttr without corresponding GetProfileAttr", () => {
      const objects = [
        makeObj("CX_Applet", "applet", {}, [
          makeScript("Foo", `function Foo() {
  try {
    TheApplication().SetProfileAttr("OrphanAttr", "value");
  } catch(e) { TheApplication().RaiseErrorText(e.toString()); }
}`),
        ]),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      expect(result.issues.some((i) => i.category === "profile_attr")).toBe(true);
    });

    it("should not flag ProfileAttr that is both set and consumed", () => {
      const objects = [
        makeObj("CX_Applet1", "applet", {}, [
          makeScript("Setter", `function Setter() {
  try {
    TheApplication().SetProfileAttr("UserRole", "Admin");
  } catch(e) { TheApplication().RaiseErrorText(e.toString()); }
}`),
        ]),
        makeObj("CX_Applet2", "applet", {}, [
          makeScript("Getter", `function Getter() {
  try {
    var role = TheApplication().GetProfileAttr("UserRole");
  } catch(e) { TheApplication().RaiseErrorText(e.toString()); }
}`),
        ]),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      const orphanAttr = result.issues.filter(
        (i) => i.category === "profile_attr" && i.detail.includes("UserRole"),
      );
      expect(orphanAttr).toHaveLength(0);
    });
  });

  // AC6: Test objects active
  describe("AC6: test objects check", () => {
    it("should flag active objects with test-like names", () => {
      const objects = [
        { ...makeObj("CX_Test Debug Applet", "applet"), inactive: false },
        { ...makeObj("CX_Temp Import View", "view"), inactive: false },
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      const testIssues = result.issues.filter((i) => i.category === "test_objects");
      expect(testIssues.length).toBeGreaterThanOrEqual(2);
    });

    it("should not flag inactive test objects", () => {
      const objects = [{ ...makeObj("CX_Test Applet", "applet"), inactive: true }];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      const testIssues = result.issues.filter((i) => i.category === "test_objects");
      expect(testIssues).toHaveLength(0);
    });
  });

  // AC7: Quality score
  describe("AC7: quality score", () => {
    it("should return score 0-100 with category breakdown", () => {
      const objects = [makeObj("CX_Applet", "applet")];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.naming).toBeDefined();
      expect(result.breakdown.error_handling).toBeDefined();
    });

    it("should give high score for clean code", () => {
      const objects = [
        makeObj("CX_Account Applet", "applet", {}, [
          makeScript("PreInvokeMethod", `function PreInvokeMethod(MethodName) {
  try {
    var x = 1;
  } catch(e) {
    TheApplication().RaiseErrorText(e.toString());
  } finally {
    x = null;
  }
}`),
        ]),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      expect(result.score).toBeGreaterThanOrEqual(70);
    });
  });

  // AC8: Suggestions
  describe("AC8: suggestions per issue", () => {
    it("should include suggestion for every issue", () => {
      const objects = [
        makeObj("Bad Name Applet", "applet", {}, [
          makeScript("Foo", `function Foo() { var x = 1; }`),
        ]),
      ];
      const result = reviewSiebelCode(objects, { prefix: "CX_" });

      for (const issue of result.issues) {
        expect(issue.suggestion).toBeDefined();
        expect(issue.suggestion.length).toBeGreaterThan(0);
      }
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("should handle empty objects array", () => {
      const result = reviewSiebelCode([], { prefix: "CX_" });

      expect(result.issues).toHaveLength(0);
      expect(result.score).toBe(100);
    });
  });
});
