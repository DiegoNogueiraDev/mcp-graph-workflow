import { describe, it, expect } from "vitest";
import { validateWsdlContract } from "../../core/siebel/wsdl-contract-validator.js";
import type { WsdlParseResult } from "../../core/siebel/wsdl-parser.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeWsdl(overrides?: Partial<WsdlParseResult>): WsdlParseResult {
  return {
    services: [{ name: "AccountService", ports: [{ name: "AccountPort", binding: "AccountBinding", address: "http://example.com" }] }],
    operations: [
      { name: "UpsertAccount", inputMessage: "UpsertAccountRequest", outputMessage: "UpsertAccountResponse" },
    ],
    types: [
      { name: "UpsertAccountRequest", fields: [
        { name: "accountName", type: "string" },
        { name: "accountStatus", type: "string" },
        { name: "address", type: "string" },
      ]},
      { name: "UpsertAccountResponse", fields: [
        { name: "accountId", type: "string" },
        { name: "success", type: "boolean" },
      ]},
    ],
    messages: [
      { name: "UpsertAccountRequest", parts: [{ name: "parameters", type: "UpsertAccountRequest" }] },
      { name: "UpsertAccountResponse", parts: [{ name: "parameters", type: "UpsertAccountResponse" }] },
    ],
    metadata: { fileName: "test.wsdl", targetNamespace: "urn:test", operationCount: 1, typeCount: 2, messageCount: 2, parsedAt: new Date().toISOString() },
    ...overrides,
  };
}

function makeBC(name: string, fieldNames: string[]): SiebelObject {
  return {
    name,
    type: "business_component",
    properties: [],
    children: fieldNames.map((f) => ({
      name: f,
      type: "field" as const,
      properties: [{ name: "COLUMN", value: f.toUpperCase() }],
      children: [],
    })),
  };
}

describe("validateWsdlContract", () => {
  it("should match WSDL fields against BC fields", () => {
    const wsdl = makeWsdl();
    const bcs = [makeBC("Account", ["accountName", "accountStatus", "address", "accountId"])];

    const result = validateWsdlContract(wsdl, bcs);

    expect(result.operations.length).toBe(1);
    expect(result.operations[0].operationName).toBe("UpsertAccount");
    expect(result.operations[0].matchedFields.length).toBeGreaterThan(0);
  });

  it("should report orphan fields (in WSDL but not in any BC)", () => {
    const wsdl = makeWsdl();
    const bcs = [makeBC("Account", ["accountName"])]; // missing accountStatus, address

    const result = validateWsdlContract(wsdl, bcs);

    expect(result.operations[0].orphanFields.length).toBeGreaterThan(0);
    expect(result.operations[0].orphanFields).toContain("accountStatus");
    expect(result.operations[0].orphanFields).toContain("address");
  });

  it("should report missing fields (in BC but not in WSDL)", () => {
    const wsdl = makeWsdl();
    const bcs = [makeBC("Account", ["accountName", "accountStatus", "address", "accountId", "extraField", "anotherExtra"])];

    const result = validateWsdlContract(wsdl, bcs);

    expect(result.operations[0].missingFields.length).toBeGreaterThan(0);
    expect(result.operations[0].missingFields).toContain("extraField");
  });

  it("should calculate conformance score (0-100)", () => {
    const wsdl = makeWsdl();
    const bcs = [makeBC("Account", ["accountName", "accountStatus", "address", "accountId", "success"])];

    const result = validateWsdlContract(wsdl, bcs);

    expect(result.operations[0].conformanceScore).toBeGreaterThanOrEqual(0);
    expect(result.operations[0].conformanceScore).toBeLessThanOrEqual(100);
    // All WSDL fields matched = 100
    expect(result.operations[0].conformanceScore).toBe(100);
  });

  it("should return partial score when some fields missing", () => {
    const wsdl = makeWsdl();
    const bcs = [makeBC("Account", ["accountName"])]; // only 1 of 5 fields

    const result = validateWsdlContract(wsdl, bcs);

    expect(result.operations[0].conformanceScore).toBeLessThan(100);
    expect(result.operations[0].conformanceScore).toBeGreaterThan(0);
  });

  it("should calculate overall score across operations", () => {
    const wsdl = makeWsdl();
    const bcs = [makeBC("Account", ["accountName", "accountStatus", "address", "accountId", "success"])];

    const result = validateWsdlContract(wsdl, bcs);

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it("should handle empty BCs gracefully", () => {
    const wsdl = makeWsdl();

    const result = validateWsdlContract(wsdl, []);

    expect(result.operations[0].conformanceScore).toBe(0);
    expect(result.operations[0].orphanFields.length).toBe(5); // all 5 WSDL fields are orphans
  });

  it("should handle WSDL with no operations", () => {
    const wsdl = makeWsdl({ operations: [], types: [] });

    const result = validateWsdlContract(wsdl, []);

    expect(result.operations.length).toBe(0);
    expect(result.overallScore).toBe(100); // no operations = fully conformant
  });
});
