import { describe, it, expect } from "vitest";
import { detectEscriptPatterns } from "../../core/siebel/escript-patterns.js";

const GOOD_SCRIPT = `function BusComp_PreWriteRecord() {
  try {
    var name = this.GetFieldValue("Name");
    if (name == "") {
      TheApplication().RaiseErrorText("Name is required");
    }
  } catch (e) {
    TheApplication().RaiseErrorText(e.toString());
  } finally {
    name = null;
  }
}`;

const BAD_SCRIPT = `function BusComp_SetFieldValue(fieldName, fieldValue) {
  try {
    if (fieldName == "Status") {
      var url = "http://server01.internal:8080/api";
      var bc = TheApplication().GetBusObject("Account").GetBusComp("Account");
      var val = bc.GetFieldValue("Name");
    }
  } catch (e) {
  }
}`;

const SCRIPT_NO_TRY = `function WebApplet_PreInvokeMethod(MethodName) {
  var name = this.GetFieldValue("Name");
  return ContinueOperation;
}`;

describe("escript-patterns", () => {
  it("should detect proper RaiseErrorText usage as good pattern", () => {
    const result = detectEscriptPatterns(GOOD_SCRIPT, "TestBC", "BusComp_PreWriteRecord");
    const raiseError = result.patterns.find((p) => p.name === "proper_error_handling");
    expect(raiseError).toBeDefined();
    expect(raiseError!.isAntiPattern).toBe(false);
  });

  it("should detect empty catch block as anti-pattern", () => {
    const result = detectEscriptPatterns(BAD_SCRIPT, "TestBC", "BusComp_SetFieldValue");
    const emptyCatch = result.patterns.find((p) => p.name === "empty_catch");
    expect(emptyCatch).toBeDefined();
    expect(emptyCatch!.isAntiPattern).toBe(true);
  });

  it("should detect hardcoded URLs as anti-pattern", () => {
    const result = detectEscriptPatterns(BAD_SCRIPT, "TestBC", "BusComp_SetFieldValue");
    const hardcoded = result.patterns.find((p) => p.name === "hardcoded_value");
    expect(hardcoded).toBeDefined();
    expect(hardcoded!.isAntiPattern).toBe(true);
  });

  it("should detect missing try/catch as anti-pattern", () => {
    const result = detectEscriptPatterns(SCRIPT_NO_TRY, "TestApplet", "WebApplet_PreInvokeMethod");
    const noTry = result.patterns.find((p) => p.name === "missing_try_catch");
    expect(noTry).toBeDefined();
    expect(noTry!.isAntiPattern).toBe(true);
  });

  it("should detect proper finally cleanup as good pattern", () => {
    const result = detectEscriptPatterns(GOOD_SCRIPT, "TestBC", "BusComp_PreWriteRecord");
    const cleanup = result.patterns.find((p) => p.name === "finally_cleanup");
    expect(cleanup).toBeDefined();
    expect(cleanup!.isAntiPattern).toBe(false);
  });

  it("should calculate quality score", () => {
    const goodResult = detectEscriptPatterns(GOOD_SCRIPT, "TestBC", "Good");
    const badResult = detectEscriptPatterns(BAD_SCRIPT, "TestBC", "Bad");
    expect(goodResult.qualityScore).toBeGreaterThan(badResult.qualityScore);
  });

  it("should include source metadata", () => {
    const result = detectEscriptPatterns(GOOD_SCRIPT, "TestBC", "BusComp_PreWriteRecord");
    expect(result.sourceObject).toBe("TestBC");
    expect(result.sourceMethod).toBe("BusComp_PreWriteRecord");
  });

  it("should handle empty script", () => {
    const result = detectEscriptPatterns("", "TestBC", "Empty");
    expect(result.patterns).toEqual([]);
    expect(result.qualityScore).toBe(0);
  });
});
