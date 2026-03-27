import { describe, it, expect } from "vitest";
import { extractScriptReferences } from "../../core/siebel/escript-crossref.js";

const SCRIPT_WITH_REFS = `function BusComp_SetFieldValue(fieldName, fieldValue) {
  if (fieldName == "Tax ID") {
    var boAccount = TheApplication().GetBusObject("Account");
    var bcSimplified = boAccount.GetBusComp("Simplified Account");
    var svc = TheApplication().GetService("Validation BS");
    var name = this.GetFieldValue("Name");
    var status = this.GetFieldValue("Account Status");
    this.SetFieldValue("Validated", "Y");
    var psIn = TheApplication().NewPropertySet();
    svc.InvokeMethod("ValidateField", psIn);
    psIn = null;
    svc = null;
    bcSimplified = null;
    boAccount = null;
  }
}`;

const SCRIPT_WITH_PROFILE = `function WebApplet_PreInvokeMethod(MethodName) {
  var userId = TheApplication().GetProfileAttr("UserId");
  TheApplication().SetProfileAttr("LastAction", MethodName);
  var lovValue = TheApplication().InvokeMethod("LookupValue", "STATUS_TYPE", "Active");
}`;

const EMPTY_SCRIPT = "";

describe("escript-crossref", () => {
  it("should detect GetBusObject references", () => {
    const refs = extractScriptReferences(SCRIPT_WITH_REFS, "TestBC", "BusComp_SetFieldValue");
    const boRefs = refs.filter((r) => r.type === "business_object");
    expect(boRefs.length).toBe(1);
    expect(boRefs[0].name).toBe("Account");
  });

  it("should detect GetBusComp references", () => {
    const refs = extractScriptReferences(SCRIPT_WITH_REFS, "TestBC", "BusComp_SetFieldValue");
    const bcRefs = refs.filter((r) => r.type === "business_component");
    expect(bcRefs.length).toBe(1);
    expect(bcRefs[0].name).toBe("Simplified Account");
  });

  it("should detect GetService references", () => {
    const refs = extractScriptReferences(SCRIPT_WITH_REFS, "TestBC", "BusComp_SetFieldValue");
    const svcRefs = refs.filter((r) => r.type === "business_service");
    expect(svcRefs.length).toBe(1);
    expect(svcRefs[0].name).toBe("Validation BS");
  });

  it("should detect GetFieldValue and SetFieldValue references", () => {
    const refs = extractScriptReferences(SCRIPT_WITH_REFS, "TestBC", "BusComp_SetFieldValue");
    const fieldRefs = refs.filter((r) => r.type === "field");
    expect(fieldRefs.length).toBe(3);
    const fieldNames = fieldRefs.map((r) => r.name);
    expect(fieldNames).toContain("Name");
    expect(fieldNames).toContain("Account Status");
    expect(fieldNames).toContain("Validated");
  });

  it("should detect GetProfileAttr and SetProfileAttr references", () => {
    const refs = extractScriptReferences(SCRIPT_WITH_PROFILE, "TestApplet", "WebApplet_PreInvokeMethod");
    const profileRefs = refs.filter((r) => r.type === "profile_attr");
    expect(profileRefs.length).toBe(2);
    const names = profileRefs.map((r) => r.name);
    expect(names).toContain("UserId");
    expect(names).toContain("LastAction");
  });

  it("should detect LookupValue references", () => {
    const refs = extractScriptReferences(SCRIPT_WITH_PROFILE, "TestApplet", "WebApplet_PreInvokeMethod");
    const lovRefs = refs.filter((r) => r.type === "lov");
    expect(lovRefs.length).toBe(1);
    expect(lovRefs[0].name).toBe("STATUS_TYPE");
  });

  it("should include source script metadata", () => {
    const refs = extractScriptReferences(SCRIPT_WITH_REFS, "TestBC", "BusComp_SetFieldValue");
    for (const ref of refs) {
      expect(ref.sourceObject).toBe("TestBC");
      expect(ref.sourceMethod).toBe("BusComp_SetFieldValue");
    }
  });

  it("should handle empty scripts", () => {
    const refs = extractScriptReferences(EMPTY_SCRIPT, "TestBC", "Empty");
    expect(refs).toEqual([]);
  });

  it("should deduplicate repeated references", () => {
    const script = `function test() {
      var a = this.GetFieldValue("Name");
      var b = this.GetFieldValue("Name");
      this.SetFieldValue("Name", "test");
    }`;
    const refs = extractScriptReferences(script, "TestBC", "test");
    const nameRefs = refs.filter((r) => r.type === "field" && r.name === "Name");
    expect(nameRefs.length).toBe(1);
  });
});
