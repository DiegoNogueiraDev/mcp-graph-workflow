import { describe, it, expect } from "vitest";
import {
  suggestFields,
  type FieldSuggestion,
  type FieldSuggestionResult,
} from "../../core/siebel/field-suggestion.js";
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
  };
}

function makeField(name: string): SiebelObject {
  return makeObj(name, "field");
}

function makeControl(fieldName: string): SiebelObject {
  return makeObj(fieldName, "control", { FIELD: fieldName });
}

describe("field-suggestion", () => {
  const bc = makeObj("CX Account BC", "business_component", {}, [
    makeField("Id"),
    makeField("Name"),
    makeField("Status"),
    makeField("Type"),
    makeField("Email"),
    makeField("Phone"),
    makeField("Created"),
  ]);

  const applet1 = makeObj("CX Account List Applet", "applet", { BUS_COMP: "CX Account BC" }, [
    makeControl("Id"),
    makeControl("Name"),
    makeControl("Status"),
    makeControl("Email"),
  ]);

  const applet2 = makeObj("CX Account Form Applet", "applet", { BUS_COMP: "CX Account BC" }, [
    makeControl("Id"),
    makeControl("Name"),
    makeControl("Status"),
    makeControl("Type"),
    makeControl("Phone"),
  ]);

  const applet3 = makeObj("CX Account Detail Applet", "applet", { BUS_COMP: "CX Account BC" }, [
    makeControl("Id"),
    makeControl("Name"),
    makeControl("Email"),
  ]);

  const repository = [bc, applet1, applet2, applet3];

  // AC1: List fields used in applets for a BC
  describe("AC1: list fields used in existing applets", () => {
    it("should list all fields used across applets for the target BC", () => {
      const result = suggestFields({ targetBcName: "CX Account BC", repository });

      expect(result.suggestions.length).toBeGreaterThan(0);
      const fieldNames = result.suggestions.map((s) => s.fieldName);
      expect(fieldNames).toContain("Id");
      expect(fieldNames).toContain("Name");
      expect(fieldNames).toContain("Status");
    });
  });

  // AC2: Rank fields by frequency
  describe("AC2: rank by frequency", () => {
    it("should rank Id and Name highest (used in all 3 applets)", () => {
      const result = suggestFields({ targetBcName: "CX Account BC", repository });

      const sorted = [...result.suggestions].sort((a, b) => b.frequency - a.frequency);
      // Id and Name appear in all 3 applets
      expect(sorted[0].frequency).toBe(3);
      expect(sorted[1].frequency).toBe(3);
      const topNames = sorted.slice(0, 2).map((s) => s.fieldName);
      expect(topNames).toContain("Id");
      expect(topNames).toContain("Name");
    });

    it("should rank less-used fields lower", () => {
      const result = suggestFields({ targetBcName: "CX Account BC", repository });

      const typeSugg = result.suggestions.find((s) => s.fieldName === "Type");
      const phoneSugg = result.suggestions.find((s) => s.fieldName === "Phone");
      // Type and Phone appear in only 1 applet each
      expect(typeSugg?.frequency).toBe(1);
      expect(phoneSugg?.frequency).toBe(1);
    });
  });

  // AC3: Required vs optional
  describe("AC3: required vs optional classification", () => {
    it("should mark high-frequency fields as required", () => {
      const result = suggestFields({ targetBcName: "CX Account BC", repository });

      const idSugg = result.suggestions.find((s) => s.fieldName === "Id");
      const nameSugg = result.suggestions.find((s) => s.fieldName === "Name");
      expect(idSugg?.classification).toBe("required");
      expect(nameSugg?.classification).toBe("required");
    });

    it("should mark low-frequency fields as optional", () => {
      const result = suggestFields({ targetBcName: "CX Account BC", repository });

      const typeSugg = result.suggestions.find((s) => s.fieldName === "Type");
      expect(typeSugg?.classification).toBe("optional");
    });
  });

  // AC4: Included in SIF generation context
  describe("AC4: SIF generation context", () => {
    it("should return appletCount and bcFieldCount for context", () => {
      const result = suggestFields({ targetBcName: "CX Account BC", repository });

      expect(result.bcFieldCount).toBe(7); // Total fields in BC
      expect(result.appletCount).toBe(3); // Applets using this BC
    });

    it("should include threshold info", () => {
      const result = suggestFields({ targetBcName: "CX Account BC", repository });

      expect(result.requiredThreshold).toBeDefined();
      expect(result.requiredThreshold).toBeGreaterThan(0);
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("should return empty suggestions for unknown BC", () => {
      const result = suggestFields({ targetBcName: "Unknown BC", repository });

      expect(result.suggestions).toHaveLength(0);
      expect(result.appletCount).toBe(0);
    });

    it("should handle BC with no applets referencing it", () => {
      const lonelyBc = makeObj("CX Orphan BC", "business_component", {}, [
        makeField("Id"),
      ]);

      const result = suggestFields({ targetBcName: "CX Orphan BC", repository: [lonelyBc] });

      expect(result.suggestions).toHaveLength(0);
      expect(result.appletCount).toBe(0);
    });

    it("should handle empty repository", () => {
      const result = suggestFields({ targetBcName: "Any BC", repository: [] });

      expect(result.suggestions).toHaveLength(0);
    });

    it("should include BC fields not used in any applet as available", () => {
      const result = suggestFields({ targetBcName: "CX Account BC", repository });

      // "Created" is a BC field but not used in any applet
      const createdSugg = result.suggestions.find((s) => s.fieldName === "Created");
      expect(createdSugg).toBeDefined();
      expect(createdSugg?.frequency).toBe(0);
      expect(createdSugg?.classification).toBe("available");
    });
  });
});
