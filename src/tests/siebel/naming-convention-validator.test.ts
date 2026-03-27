import { describe, it, expect } from "vitest";
import {
  validateNamingConventions,
  type NamingRuleSet,
} from "../../core/siebel/naming-convention-validator.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(
  overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] },
): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const STANDARD_RULES: NamingRuleSet = {
  name: "Standard",
  prefixes: [
    { prefix: "CX_", appliesTo: ["applet", "business_component", "view", "screen"] },
  ],
  caseRules: [
    { pattern: "PascalCase", appliesTo: ["applet", "view", "screen"] },
  ],
  exceptions: [
    { objectName: "Account", reason: "Base Siebel object" },
    { objectName: "Contact", reason: "Base Siebel object" },
  ],
};

const MULTI_PREFIX_RULES: NamingRuleSet = {
  name: "Multi Prefix",
  prefixes: [
    { prefix: "CX_", appliesTo: ["applet", "business_component", "view"] },
    { prefix: "XX_", appliesTo: ["applet", "business_component", "view"] },
    { prefix: "ZZ_", appliesTo: ["applet", "business_component", "view"] },
  ],
  caseRules: [],
  exceptions: [],
};

describe("naming-convention-validator", () => {
  describe("prefix validation", () => {
    it("should pass objects with correct prefix", () => {
      const objects: SiebelObject[] = [
        makeObj({ name: "CX_Account List Applet", type: "applet" }),
        makeObj({ name: "CX_Account BC", type: "business_component" }),
      ];

      const result = validateNamingConventions(objects, STANDARD_RULES);

      expect(result.status).toBe("valid");
      expect(result.violations).toHaveLength(0);
      expect(result.checkedCount).toBe(2);
    });

    it("should flag objects missing required prefix", () => {
      const objects: SiebelObject[] = [
        makeObj({ name: "Custom Account List Applet", type: "applet" }),
        makeObj({ name: "CX_Contact Form Applet", type: "applet" }),
      ];

      const result = validateNamingConventions(objects, STANDARD_RULES);

      expect(result.status).toBe("warnings");
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].objectName).toBe("Custom Account List Applet");
      expect(result.violations[0].rule).toBe("prefix");
      expect(result.violations[0].expected).toContain("CX_");
    });

    it("should accept any of multiple valid prefixes", () => {
      const objects: SiebelObject[] = [
        makeObj({ name: "CX_Account Applet", type: "applet" }),
        makeObj({ name: "XX_Account Applet", type: "applet" }),
        makeObj({ name: "ZZ_Account Applet", type: "applet" }),
      ];

      const result = validateNamingConventions(objects, MULTI_PREFIX_RULES);

      expect(result.status).toBe("valid");
      expect(result.violations).toHaveLength(0);
    });

    it("should skip object types not covered by prefix rules", () => {
      const objects: SiebelObject[] = [
        makeObj({ name: "Some Random Field", type: "field" }),
        makeObj({ name: "My User Property", type: "user_property" }),
      ];

      const result = validateNamingConventions(objects, STANDARD_RULES);

      expect(result.violations).toHaveLength(0);
      expect(result.skippedCount).toBe(2);
    });
  });

  describe("case validation", () => {
    it("should validate PascalCase naming", () => {
      const objects: SiebelObject[] = [
        makeObj({ name: "CX_Account List Applet", type: "applet" }),
      ];

      const result = validateNamingConventions(objects, STANDARD_RULES);

      expect(result.violations.filter((v) => v.rule === "case")).toHaveLength(0);
    });

    it("should flag all-lowercase names when PascalCase expected", () => {
      const objects: SiebelObject[] = [
        makeObj({ name: "CX_account list applet", type: "applet" }),
      ];

      const result = validateNamingConventions(objects, STANDARD_RULES);

      const caseViolations = result.violations.filter((v) => v.rule === "case");
      expect(caseViolations).toHaveLength(1);
      expect(caseViolations[0].expected).toContain("PascalCase");
    });
  });

  describe("exceptions", () => {
    it("should skip exception objects even if they lack prefix", () => {
      const objects: SiebelObject[] = [
        makeObj({ name: "Account", type: "business_component" }),
        makeObj({ name: "Contact", type: "business_component" }),
        makeObj({ name: "Custom BC Without Prefix", type: "business_component" }),
      ];

      const result = validateNamingConventions(objects, STANDARD_RULES);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].objectName).toBe("Custom BC Without Prefix");
      expect(result.exceptedCount).toBe(2);
    });
  });

  describe("result summary", () => {
    it("should return comprehensive result summary", () => {
      const objects: SiebelObject[] = [
        makeObj({ name: "CX_Good Applet", type: "applet" }),
        makeObj({ name: "Bad Applet", type: "applet" }),
        makeObj({ name: "Account", type: "business_component" }),
        makeObj({ name: "Some Field", type: "field" }),
      ];

      const result = validateNamingConventions(objects, STANDARD_RULES);

      expect(result.ruleSetName).toBe("Standard");
      expect(result.checkedCount).toBe(2); // 2 applets (Account excepted, field skipped)
      expect(result.skippedCount).toBe(1); // field
      expect(result.exceptedCount).toBe(1); // Account
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("should return valid status for empty input", () => {
      const result = validateNamingConventions([], STANDARD_RULES);

      expect(result.status).toBe("valid");
      expect(result.checkedCount).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty objects array", () => {
      const result = validateNamingConventions([], STANDARD_RULES);

      expect(result.status).toBe("valid");
      expect(result.violations).toEqual([]);
      expect(result.checkedCount).toBe(0);
    });

    it("should handle empty rules", () => {
      const emptyRules: NamingRuleSet = {
        name: "Empty",
        prefixes: [],
        caseRules: [],
        exceptions: [],
      };

      const objects: SiebelObject[] = [
        makeObj({ name: "Anything", type: "applet" }),
      ];

      const result = validateNamingConventions(objects, emptyRules);

      expect(result.status).toBe("valid");
    });
  });
});
