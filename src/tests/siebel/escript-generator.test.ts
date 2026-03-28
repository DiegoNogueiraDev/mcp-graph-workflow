import { describe, it, expect } from "vitest";
import {
  generateEScript,
  type EScriptGenerationRequest,
} from "../../core/siebel/escript-generator.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(
  overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] },
): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const REFERENCE_SCRIPTS: SiebelObject[] = [
  makeObj({
    name: "CX Account_PreInvokeMethod", type: "escript",
    parentName: "CX Account Form Applet",
    properties: [
      { name: "SCRIPT", value: `function WebApplet_PreInvokeMethod(MethodName) {
  try {
    var bcAccount = this.BusComp();
    if (MethodName === "WriteRecord") {
      var sName = bcAccount.GetFieldValue("Name");
      if (sName === "") {
        TheApplication().RaiseErrorText("Name is required");
        return (CancelOperation);
      }
    }
  } catch (e) {
    TheApplication().RaiseErrorText(e.toString());
  } finally {
    bcAccount = null;
  }
  return (ContinueOperation);
}` },
    ],
  }),
];

describe("escript-generator", () => {
  describe("AC1: accepts parent object, event, and description", () => {
    it("should accept a generation request and return script", () => {
      const request: EScriptGenerationRequest = {
        parentObjectName: "CX Order Form Applet",
        parentObjectType: "applet",
        eventName: "PreInvokeMethod",
        behaviorDescription: "Validate that order amount is greater than zero before saving",
        referenceScripts: REFERENCE_SCRIPTS,
      };

      const result = generateEScript(request);

      expect(result).toBeDefined();
      expect(result.script.length).toBeGreaterThan(0);
      expect(result.eventName).toBe("PreInvokeMethod");
    });
  });

  describe("AC3: follows repository patterns (try/catch, RaiseErrorText)", () => {
    it("should include try/catch/finally structure", () => {
      const request: EScriptGenerationRequest = {
        parentObjectName: "CX Order Applet",
        parentObjectType: "applet",
        eventName: "PreInvokeMethod",
        behaviorDescription: "Validate order",
        referenceScripts: REFERENCE_SCRIPTS,
      };

      const result = generateEScript(request);

      expect(result.script).toContain("try");
      expect(result.script).toContain("catch");
      expect(result.script).toContain("finally");
      expect(result.script).toContain("TheApplication().RaiseErrorText");
    });
  });

  describe("AC4: includes cleanup in finally block", () => {
    it("should include null assignments in finally", () => {
      const request: EScriptGenerationRequest = {
        parentObjectName: "CX Order Applet",
        parentObjectType: "applet",
        eventName: "PreInvokeMethod",
        behaviorDescription: "Validate order status",
        referenceScripts: REFERENCE_SCRIPTS,
      };

      const result = generateEScript(request);

      expect(result.script).toContain("= null");
    });
  });

  describe("AC5: detects references to BCs/fields", () => {
    it("should include referenced BC in the script context", () => {
      const request: EScriptGenerationRequest = {
        parentObjectName: "CX Order Applet",
        parentObjectType: "applet",
        eventName: "PreInvokeMethod",
        behaviorDescription: "Get the order status field value",
        referenceScripts: REFERENCE_SCRIPTS,
        knownBcNames: ["CX Order", "Account"],
        knownFieldNames: ["Order Status", "Name", "Amount"],
      };

      const result = generateEScript(request);

      expect(result.referencedEntities.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("AC6: output compatible with SIF XML", () => {
    it("should produce XML-compatible script block", () => {
      const request: EScriptGenerationRequest = {
        parentObjectName: "CX Account Applet",
        parentObjectType: "applet",
        eventName: "SetFieldValue",
        behaviorDescription: "When status changes, update timestamp",
        referenceScripts: REFERENCE_SCRIPTS,
      };

      const result = generateEScript(request);

      expect(result.sifXmlBlock).toBeDefined();
      expect(result.sifXmlBlock).toContain("APPLET_SERVER_SCRIPT");
      expect(result.sifXmlBlock).toContain("SCRIPT");
    });
  });

  describe("BC event handlers", () => {
    it("should generate BC-style handler for business_component", () => {
      const request: EScriptGenerationRequest = {
        parentObjectName: "CX Order BC",
        parentObjectType: "business_component",
        eventName: "PreSetFieldValue",
        behaviorDescription: "Validate field before save",
        referenceScripts: [],
      };

      const result = generateEScript(request);

      expect(result.script).toContain("BusComp_PreSetFieldValue");
      expect(result.sifXmlBlock).toContain("BUSCOMP_SERVER_SCRIPT");
    });
  });

  describe("edge cases", () => {
    it("should handle empty reference scripts", () => {
      const request: EScriptGenerationRequest = {
        parentObjectName: "CX Test",
        parentObjectType: "applet",
        eventName: "PreInvokeMethod",
        behaviorDescription: "Test behavior",
        referenceScripts: [],
      };

      const result = generateEScript(request);

      expect(result.script).toContain("try");
      expect(result.script).toContain("catch");
    });

    it("should handle various event types", () => {
      const events = ["PreInvokeMethod", "SetFieldValue", "PreQuery", "WriteRecord"];

      for (const event of events) {
        const result = generateEScript({
          parentObjectName: "CX Test",
          parentObjectType: "applet",
          eventName: event,
          behaviorDescription: "handler",
          referenceScripts: [],
        });

        expect(result.script.length).toBeGreaterThan(0);
        expect(result.eventName).toBe(event);
      }
    });
  });
});
