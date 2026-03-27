import { describe, it, expect } from "vitest";
import { correlateWsdlWithObjects } from "../../core/siebel/wsdl-correlation.js";
import type { WsdlParseResult } from "../../core/siebel/wsdl-parser.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const WSDL_RESULT: WsdlParseResult = {
  services: [{ name: "AccountWebService", ports: [{ name: "AccountPort", binding: "AccountBinding", address: "http://example.com" }] }],
  operations: [
    { name: "UpsertAccount", inputMessage: "UpsertAccountInput", outputMessage: "UpsertAccountOutput" },
    { name: "GetCustomerAssets", inputMessage: "GetAssetsInput", outputMessage: "GetAssetsOutput" },
  ],
  types: [],
  messages: [],
  metadata: { fileName: "test.wsdl", targetNamespace: "http://example.com", operationCount: 2, typeCount: 0, messageCount: 0, parsedAt: "" },
};

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account IO", type: "integration_object", properties: [{ name: "BUS_COMP", value: "Account" }] }),
  makeObj({ name: "Account", type: "business_component", properties: [{ name: "TABLE", value: "S_ORG_EXT" }] }),
  makeObj({ name: "Order IO", type: "integration_object", properties: [{ name: "BUS_COMP", value: "Order" }] }),
];

describe("wsdl-correlation", () => {
  it("should match WSDL service to Integration Objects by name similarity", () => {
    const result = correlateWsdlWithObjects(WSDL_RESULT, OBJECTS);
    expect(result.matches.length).toBeGreaterThan(0);
    const accountMatch = result.matches.find((m) => m.ioName === "Account IO");
    expect(accountMatch).toBeDefined();
  });

  it("should identify unmatched WSDLs (gaps)", () => {
    const emptyResult = correlateWsdlWithObjects(WSDL_RESULT, []);
    expect(emptyResult.unmatchedOperations.length).toBe(2);
  });

  it("should identify unmatched IOs", () => {
    const result = correlateWsdlWithObjects(WSDL_RESULT, OBJECTS);
    const unmatchedIO = result.unmatchedIOs.find((io) => io === "Order IO");
    expect(unmatchedIO).toBeDefined();
  });

  it("should include coverage score", () => {
    const result = correlateWsdlWithObjects(WSDL_RESULT, OBJECTS);
    expect(result.coverageScore).toBeGreaterThanOrEqual(0);
    expect(result.coverageScore).toBeLessThanOrEqual(100);
  });

  it("should handle empty inputs", () => {
    const emptyWsdl: WsdlParseResult = { ...WSDL_RESULT, operations: [], services: [] };
    const result = correlateWsdlWithObjects(emptyWsdl, []);
    expect(result.matches).toEqual([]);
    expect(result.coverageScore).toBe(100);
  });
});
