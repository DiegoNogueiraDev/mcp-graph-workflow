import { describe, it, expect } from "vitest";
import {
  checkSiebelReady,
} from "../../core/siebel/definition-of-ready.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

// --- Factory ---

function makeObj(
  name: string,
  type: SiebelObject["type"],
  props: Record<string, string> = {},
  children: SiebelObject[] = [],
): SiebelObject {
  return { name, type, properties: Object.entries(props).map(([k, v]) => ({ name: k, value: v })), children };
}

describe("definition-of-ready", () => {
  // AC1: SIF dependency resolution
  describe("AC1: dependencies resolved", () => {
    it("should pass when all referenced objects exist", () => {
      const target = makeObj("CX Account Applet", "applet", { BUS_COMP: "CX Account BC" });
      const repo = [makeObj("CX Account BC", "business_component")];

      const result = checkSiebelReady({ targetObjects: [target], repository: repo, prefix: "CX_" });

      const depCheck = result.checks.find((c) => c.name === "dependencies_resolved");
      expect(depCheck?.passed).toBe(true);
    });

    it("should fail when referenced BC is missing", () => {
      const target = makeObj("CX Order Applet", "applet", { BUS_COMP: "CX Order BC" });

      const result = checkSiebelReady({ targetObjects: [target], repository: [], prefix: "CX_" });

      const depCheck = result.checks.find((c) => c.name === "dependencies_resolved");
      expect(depCheck?.passed).toBe(false);
    });
  });

  // AC2: Naming convention
  describe("AC2: naming convention", () => {
    it("should pass with correct prefix", () => {
      const target = makeObj("CX_Account BC", "business_component");

      const result = checkSiebelReady({ targetObjects: [target], repository: [], prefix: "CX_" });

      const nameCheck = result.checks.find((c) => c.name === "naming_convention");
      expect(nameCheck?.passed).toBe(true);
    });

    it("should fail without prefix", () => {
      const target = makeObj("Account BC", "business_component");

      const result = checkSiebelReady({ targetObjects: [target], repository: [], prefix: "CX_" });

      const nameCheck = result.checks.find((c) => c.name === "naming_convention");
      expect(nameCheck?.passed).toBe(false);
    });
  });

  // AC3: WSDL available for integration
  describe("AC3: WSDL availability for integrations", () => {
    it("should pass when IO has corresponding WSDL parsed", () => {
      const target = makeObj("CX_Account IO", "integration_object");

      const result = checkSiebelReady({
        targetObjects: [target],
        repository: [],
        prefix: "CX_",
        availableWsdls: ["AccountService.wsdl"],
      });

      const wsdlCheck = result.checks.find((c) => c.name === "wsdl_available");
      expect(wsdlCheck?.passed).toBe(true);
    });

    it("should fail when IO has no WSDL", () => {
      const target = makeObj("CX_Order IO", "integration_object");

      const result = checkSiebelReady({
        targetObjects: [target],
        repository: [],
        prefix: "CX_",
        availableWsdls: [],
      });

      const wsdlCheck = result.checks.find((c) => c.name === "wsdl_available");
      expect(wsdlCheck?.passed).toBe(false);
    });

    it("should skip WSDL check for non-IO objects", () => {
      const target = makeObj("CX_Account BC", "business_component");

      const result = checkSiebelReady({ targetObjects: [target], repository: [], prefix: "CX_" });

      const wsdlCheck = result.checks.find((c) => c.name === "wsdl_available");
      expect(wsdlCheck).toBeUndefined();
    });
  });

  // AC4: Applet BC fields
  describe("AC4: applet BC has required fields", () => {
    it("should pass when BC has fields referenced by applet controls", () => {
      const bc = makeObj("CX_Account BC", "business_component", {}, [
        makeObj("Name", "field"),
        makeObj("Status", "field"),
      ]);
      const applet = makeObj("CX_Account Applet", "applet", { BUS_COMP: "CX_Account BC" }, [
        makeObj("Name", "control", { FIELD: "Name" }),
      ]);

      const result = checkSiebelReady({ targetObjects: [applet], repository: [bc], prefix: "CX_" });

      const fieldCheck = result.checks.find((c) => c.name === "bc_fields_exist");
      expect(fieldCheck?.passed).toBe(true);
    });

    it("should fail when applet references field not in BC", () => {
      const bc = makeObj("CX_Account BC", "business_component", {}, [
        makeObj("Name", "field"),
      ]);
      const applet = makeObj("CX_Account Applet", "applet", { BUS_COMP: "CX_Account BC" }, [
        makeObj("MissingField", "control", { FIELD: "MissingField" }),
      ]);

      const result = checkSiebelReady({ targetObjects: [applet], repository: [bc], prefix: "CX_" });

      const fieldCheck = result.checks.find((c) => c.name === "bc_fields_exist");
      expect(fieldCheck?.passed).toBe(false);
    });
  });

  // AC5: Lock conflicts
  describe("AC5: no lock conflicts", () => {
    it("should pass when no objects are locked by others", () => {
      const target = makeObj("CX_Account BC", "business_component");

      const result = checkSiebelReady({ targetObjects: [target], repository: [], prefix: "CX_", currentUser: "me" });

      const lockCheck = result.checks.find((c) => c.name === "no_lock_conflicts");
      expect(lockCheck?.passed).toBe(true);
    });

    it("should fail when object locked by another user", () => {
      const target = makeObj("CX_Account BC", "business_component", { OBJECT_LOCKED: "Y", LOCKED_BY: "other_user" });

      const result = checkSiebelReady({ targetObjects: [target], repository: [], prefix: "CX_", currentUser: "me" });

      const lockCheck = result.checks.find((c) => c.name === "no_lock_conflicts");
      expect(lockCheck?.passed).toBe(false);
    });
  });

  // Overall
  describe("overall readiness", () => {
    it("should return ready=true when all checks pass", () => {
      const target = makeObj("CX_Account BC", "business_component");

      const result = checkSiebelReady({ targetObjects: [target], repository: [], prefix: "CX_" });

      expect(result.ready).toBe(true);
    });

    it("should return ready=false when any check fails", () => {
      const target = makeObj("Bad Applet", "applet", { BUS_COMP: "Missing BC" });

      const result = checkSiebelReady({ targetObjects: [target], repository: [], prefix: "CX_" });

      expect(result.ready).toBe(false);
    });

    it("should handle empty target objects", () => {
      const result = checkSiebelReady({ targetObjects: [], repository: [], prefix: "CX_" });

      expect(result.ready).toBe(true);
      expect(result.checks).toHaveLength(0);
    });
  });
});
