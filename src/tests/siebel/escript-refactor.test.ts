import { describe, it, expect } from "vitest";
import {
  refactorEscript,
  type RefactorResult,
  type RefactorIssue,
} from "../../core/siebel/escript-refactor.js";

describe("escript-refactor", () => {
  // AC1: Dead code detection and removal
  describe("AC1: dead code removal", () => {
    it("should detect and remove dead code marked with comments", () => {
      const code = `function Test_PreInvokeMethod(MethodName) {
  var x = 1;
  /* FNAGHAR IP2015.12 Dead Code */
  var y = 2;
  var z = 3;
  /* End Dead Code */
  return x + z;
}`;
      const result = refactorEscript(code);

      expect(result.issues.some((i) => i.type === "dead_code")).toBe(true);
      expect(result.refactored).not.toContain("FNAGHAR");
      expect(result.refactored).not.toContain("var y = 2");
      expect(result.refactored).toContain("var x = 1");
      expect(result.refactored).toContain("return x + z");
    });

    it("should detect inline dead code markers", () => {
      const code = `function Foo() {
  // Dead Code - old implementation
  var old = "unused";
  // End Dead Code
  var active = "used";
}`;
      const result = refactorEscript(code);

      expect(result.issues.some((i) => i.type === "dead_code")).toBe(true);
    });
  });

  // AC2: Unused variable detection
  describe("AC2: unused variables", () => {
    it("should detect declared but unused variables", () => {
      const code = `function Test_PreInvokeMethod(MethodName) {
  var sMsg = "";
  var unused1 = "hello";
  var unused2;
  sMsg = "active";
  return sMsg;
}`;
      const result = refactorEscript(code);

      const unusedIssues = result.issues.filter((i) => i.type === "unused_variable");
      expect(unusedIssues.length).toBeGreaterThanOrEqual(1);
      // unused1 or unused2 should be flagged
      const names = unusedIssues.map((i) => i.detail);
      expect(names.some((n) => n.includes("unused1") || n.includes("unused2"))).toBe(true);
    });

    it("should NOT flag variables that are used", () => {
      const code = `function Foo() {
  var bc = TheApplication().GetBusComp("Account");
  bc.ClearToQuery();
  bc = null;
}`;
      const result = refactorEscript(code);

      const unusedIssues = result.issues.filter((i) => i.type === "unused_variable" && i.detail.includes("bc"));
      expect(unusedIssues).toHaveLength(0);
    });
  });

  // AC3: Duplicate LOV lookups
  describe("AC3: duplicate LOV lookups", () => {
    it("should detect repeated lookups to same LOV", () => {
      const code = `function Foo() {
  var val1 = TheApplication().InvokeMethod("LookupValue", "STATUS_TYPE", "Active");
  var val2 = TheApplication().InvokeMethod("LookupValue", "STATUS_TYPE", "Inactive");
  var val3 = TheApplication().InvokeMethod("LookupValue", "STATUS_TYPE", "Active");
}`;
      const result = refactorEscript(code);

      expect(result.issues.some((i) => i.type === "duplicate_lookup")).toBe(true);
    });

    it("should suggest caching for repeated LOV lookups", () => {
      const code = `function Foo() {
  var a = TheApplication().InvokeMethod("LookupValue", "PRIORITY", "High");
  var b = TheApplication().InvokeMethod("LookupValue", "PRIORITY", "High");
}`;
      const result = refactorEscript(code);

      const dupIssue = result.issues.find((i) => i.type === "duplicate_lookup");
      expect(dupIssue).toBeDefined();
      expect(dupIssue!.suggestion).toContain("cache");
    });
  });

  // AC4: Add try/catch/finally
  describe("AC4: missing try/catch", () => {
    it("should add try/catch/finally to scripts without error handling", () => {
      const code = `function Test_PreInvokeMethod(MethodName) {
  var bc = TheApplication().GetBusComp("Account");
  bc.ClearToQuery();
  bc.ExecuteQuery();
}`;
      const result = refactorEscript(code);

      expect(result.issues.some((i) => i.type === "missing_try_catch")).toBe(true);
      expect(result.refactored).toContain("try");
      expect(result.refactored).toContain("catch");
      expect(result.refactored).toContain("finally");
    });

    it("should NOT modify scripts that already have try/catch", () => {
      const code = `function Foo() {
  try {
    var x = 1;
  } catch(e) {
    TheApplication().RaiseErrorText(e.toString());
  } finally {
    x = null;
  }
}`;
      const result = refactorEscript(code);

      expect(result.issues.some((i) => i.type === "missing_try_catch")).toBe(false);
    });
  });

  // AC5: Memory cleanup in finally
  describe("AC5: memory cleanup", () => {
    it("should add null assignments for Siebel objects in finally", () => {
      const code = `function Foo() {
  try {
    var bc = TheApplication().GetBusComp("Account");
    var bs = TheApplication().GetService("Workflow");
    bc.ClearToQuery();
    bs.InvokeMethod("Run");
  } catch(e) {
    TheApplication().RaiseErrorText(e.toString());
  } finally {
  }
}`;
      const result = refactorEscript(code);

      expect(result.issues.some((i) => i.type === "missing_cleanup")).toBe(true);
      expect(result.refactored).toContain("bc = null");
      expect(result.refactored).toContain("bs = null");
    });

    it("should NOT flag already cleaned up objects", () => {
      const code = `function Foo() {
  try {
    var bc = TheApplication().GetBusComp("Account");
  } catch(e) {
    TheApplication().RaiseErrorText(e.toString());
  } finally {
    bc = null;
  }
}`;
      const result = refactorEscript(code);

      const cleanupIssues = result.issues.filter((i) => i.type === "missing_cleanup");
      expect(cleanupIssues).toHaveLength(0);
    });
  });

  // AC6: GetFieldValue without ActivateField
  describe("AC6: GetFieldValue without ActivateField", () => {
    it("should detect GetFieldValue on non-activated field", () => {
      const code = `function Foo() {
  try {
    var bc = TheApplication().ActiveBusComp();
    var val = bc.GetFieldValue("Custom Field");
  } catch(e) {
    TheApplication().RaiseErrorText(e.toString());
  }
}`;
      const result = refactorEscript(code);

      expect(result.issues.some((i) => i.type === "missing_activate_field")).toBe(true);
    });

    it("should NOT flag when ActivateField is called before GetFieldValue", () => {
      const code = `function Foo() {
  try {
    var bc = TheApplication().ActiveBusComp();
    bc.ActivateField("Custom Field");
    var val = bc.GetFieldValue("Custom Field");
  } catch(e) {
    TheApplication().RaiseErrorText(e.toString());
  }
}`;
      const result = refactorEscript(code);

      const activateIssues = result.issues.filter(
        (i) => i.type === "missing_activate_field" && i.detail.includes("Custom Field"),
      );
      expect(activateIssues).toHaveLength(0);
    });
  });

  // AC7: Diff generation
  describe("AC7: diff output", () => {
    it("should produce diff between original and refactored", () => {
      const code = `function Foo() {
  var bc = TheApplication().GetBusComp("Account");
  bc.ClearToQuery();
}`;
      const result = refactorEscript(code);

      expect(result.diff).toBeDefined();
      expect(result.diff.length).toBeGreaterThan(0);
      // Diff should contain added/removed indicators
      expect(result.diff.some((d) => d.type === "added" || d.type === "removed")).toBe(true);
    });

    it("should return empty diff when no changes needed", () => {
      const code = `function Foo() {
  try {
    var bc = TheApplication().GetBusComp("Account");
    bc.ActivateField("Name");
    var val = bc.GetFieldValue("Name");
  } catch(e) {
    TheApplication().RaiseErrorText(e.toString());
  } finally {
    bc = null;
  }
}`;
      const result = refactorEscript(code);

      // If no issues requiring code changes → no diff
      const codeChangingIssues = result.issues.filter(
        (i) => i.type === "missing_try_catch" || i.type === "missing_cleanup" || i.type === "dead_code",
      );
      if (codeChangingIssues.length === 0) {
        expect(result.diff).toHaveLength(0);
      }
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("should handle empty script", () => {
      const result = refactorEscript("");
      expect(result.issues).toHaveLength(0);
      expect(result.refactored).toBe("");
      expect(result.diff).toHaveLength(0);
    });

    it("should handle script with only whitespace", () => {
      const result = refactorEscript("   \n\n  ");
      expect(result.issues).toHaveLength(0);
    });
  });
});
