import { describe, it, expect } from "vitest";
import {
  validateSecurity,
  validatePerformance,
  validateMigrationReadiness,
  type SecurityValidationResult,
  type PerformanceValidationResult,
  type MigrationReadinessResult,
} from "../../core/siebel/siebel-validators.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

function makeObj(
  overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] },
): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

// === SECURITY VALIDATION (10.2) ===

describe("validateSecurity", () => {
  it("AC1: should detect sensitive fields without masking (CPF, CNPJ, credit card)", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX Person BC", type: "business_component",
        children: [
          makeObj({ name: "CPF", type: "field", parentName: "CX Person BC",
            properties: [{ name: "COLUMN", value: "CPF_NUM" }] }),
          makeObj({ name: "CNPJ", type: "field", parentName: "CX Person BC",
            properties: [{ name: "COLUMN", value: "CNPJ_NUM" }] }),
          makeObj({ name: "Credit Card Number", type: "field", parentName: "CX Person BC",
            properties: [{ name: "COLUMN", value: "CC_NUM" }] }),
          makeObj({ name: "Name", type: "field", parentName: "CX Person BC",
            properties: [{ name: "COLUMN", value: "NAME" }] }),
        ],
        properties: [{ name: "TABLE", value: "S_CONTACT" }],
      }),
    ];

    const result = validateSecurity(objects);

    expect(result.sensitiveFields.length).toBeGreaterThanOrEqual(3);
    expect(result.sensitiveFields.map((f) => f.fieldName)).toContain("CPF");
    expect(result.sensitiveFields.map((f) => f.fieldName)).toContain("CNPJ");
    expect(result.sensitiveFields.map((f) => f.fieldName)).toContain("Credit Card Number");
  });

  it("AC2: should detect applets with DeleteRecord enabled on critical objects", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX Account Applet", type: "applet",
        properties: [{ name: "BUS_COMP", value: "Account" }],
        children: [
          makeObj({ name: "DeleteRecord", type: "control", parentName: "CX Account Applet",
            properties: [{ name: "METHOD_INVOKED", value: "DeleteRecord" }] }),
        ],
      }),
    ];

    const result = validateSecurity(objects);

    expect(result.dangerousOperations.length).toBeGreaterThanOrEqual(1);
    expect(result.dangerousOperations[0].objectName).toBe("CX Account Applet");
  });

  it("AC3: should check visibility rules in views and applets", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX Sensitive View", type: "view",
        properties: [{ name: "BUS_OBJECT", value: "Account" }],
        // No VISIBILITY_TYPE property → warning
      }),
    ];

    const result = validateSecurity(objects);

    expect(result.visibilityIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("AC4: should produce LGPD compliance report", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX Contact BC", type: "business_component",
        children: [
          makeObj({ name: "Email", type: "field", parentName: "CX Contact BC",
            properties: [{ name: "COLUMN", value: "EMAIL_ADDR" }] }),
          makeObj({ name: "Phone", type: "field", parentName: "CX Contact BC",
            properties: [{ name: "COLUMN", value: "PHONE_NUM" }] }),
        ],
        properties: [{ name: "TABLE", value: "S_CONTACT" }],
      }),
    ];

    const result = validateSecurity(objects);

    expect(result.lgpdReport).toBeDefined();
    expect(result.lgpdReport.personalFieldsExposed).toBeGreaterThan(0);
  });

  it("should handle empty input", () => {
    const result = validateSecurity([]);
    expect(result.sensitiveFields).toEqual([]);
    expect(result.status).toBe("valid");
  });
});

// === PERFORMANCE VALIDATION (10.3) ===

describe("validatePerformance", () => {
  it("AC1: should warn for BCs with >50 fields, error for >100", () => {
    const fields = Array.from({ length: 55 }, (_, i) =>
      makeObj({ name: `Field${i}`, type: "field", parentName: "Big BC",
        properties: [{ name: "COLUMN", value: `COL_${i}` }] }),
    );

    const objects: SiebelObject[] = [
      makeObj({
        name: "Big BC", type: "business_component",
        properties: [{ name: "TABLE", value: "S_ORG_EXT" }],
        children: fields,
      }),
    ];

    const result = validatePerformance(objects);

    expect(result.issues.some((i) => i.objectName === "Big BC" && i.rule === "excessive_fields")).toBe(true);
  });

  it("AC2: should detect BCs without search spec or sort spec", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX Account", type: "business_component",
        properties: [{ name: "TABLE", value: "S_ORG_EXT" }],
        // No SEARCH_SPEC or SORT_SPEC
      }),
    ];

    const result = validatePerformance(objects);

    expect(result.issues.some((i) => i.rule === "missing_search_spec")).toBe(true);
  });

  it("AC3: should warn for views with >5 applets", () => {
    const appletRefs = Array.from({ length: 7 }, (_, i) =>
      makeObj({ name: `Applet${i}`, type: "applet", parentName: "Big View" }),
    );

    const objects: SiebelObject[] = [
      makeObj({
        name: "Big View", type: "view",
        properties: [{ name: "BUS_OBJECT", value: "Account" }],
        children: appletRefs,
      }),
    ];

    const result = validatePerformance(objects);

    expect(result.issues.some((i) => i.rule === "excessive_applets")).toBe(true);
  });

  it("AC5: should detect scripts with potential infinite loops", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "Bad Script", type: "escript",
        properties: [{ name: "SCRIPT", value: "while(true) { doSomething(); }" }],
      }),
    ];

    const result = validatePerformance(objects);

    expect(result.issues.some((i) => i.rule === "potential_infinite_loop")).toBe(true);
  });

  it("should handle empty input", () => {
    const result = validatePerformance([]);
    expect(result.issues).toEqual([]);
    expect(result.status).toBe("valid");
  });
});

// === MIGRATION READINESS (10.4) ===

describe("validateMigrationReadiness", () => {
  it("AC1: should detect unresolved dependencies", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX Order Applet", type: "applet",
        properties: [{ name: "BUS_COMP", value: "CX Order BC" }],
      }),
      // CX Order BC is missing from objects!
    ];
    const deps: SiebelDependency[] = [
      { from: { name: "CX Order Applet", type: "applet" },
        to: { name: "CX Order BC", type: "business_component" },
        relationType: "uses" },
    ];

    const result = validateMigrationReadiness(objects, deps);

    expect(result.unresolvedDeps.length).toBeGreaterThan(0);
    expect(result.checklist.some((c) => c.check === "dependencies_resolved" && c.status === "red")).toBe(true);
  });

  it("AC2: should detect circular dependencies", () => {
    const objects: SiebelObject[] = [
      makeObj({ name: "A", type: "business_component", properties: [] }),
      makeObj({ name: "B", type: "business_component", properties: [] }),
    ];
    const deps: SiebelDependency[] = [
      { from: { name: "A", type: "business_component" }, to: { name: "B", type: "business_component" }, relationType: "uses" },
      { from: { name: "B", type: "business_component" }, to: { name: "A", type: "business_component" }, relationType: "uses" },
    ];

    const result = validateMigrationReadiness(objects, deps);

    expect(result.hasCycles).toBe(true);
    expect(result.checklist.some((c) => c.check === "no_circular_deps" && c.status === "red")).toBe(true);
  });

  it("AC4: should detect hardcoded environment values in scripts", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX Script", type: "escript",
        properties: [
          { name: "SCRIPT", value: 'var url = "https://prod-server.company.com/api";' },
        ],
      }),
    ];

    const result = validateMigrationReadiness(objects, []);

    expect(result.hardcodedValues.length).toBeGreaterThan(0);
  });

  it("AC5: should produce checklist with green/yellow/red", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX Good BC", type: "business_component",
        properties: [{ name: "TABLE", value: "S_ORG_EXT" }],
      }),
    ];

    const result = validateMigrationReadiness(objects, []);

    expect(result.checklist.length).toBeGreaterThan(0);
    for (const item of result.checklist) {
      expect(["green", "yellow", "red"]).toContain(item.status);
    }
  });

  it("should handle empty input", () => {
    const result = validateMigrationReadiness([], []);
    // 0 objects → yellow status (object_count check)
    expect(result.status).toBe("warnings");
    expect(result.checklist.length).toBeGreaterThan(0);
    expect(result.unresolvedDeps).toEqual([]);
    expect(result.hasCycles).toBe(false);
  });
});
