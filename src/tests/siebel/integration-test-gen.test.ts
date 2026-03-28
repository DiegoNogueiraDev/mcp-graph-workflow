import { describe, it, expect } from "vitest";
import {
  generateIntegrationTests,
} from "../../core/siebel/integration-test-gen.js";
import type { WsdlParseResult } from "../../core/siebel/wsdl-parser.js";

// --- Factory ---

function makeWsdl(overrides: Partial<WsdlParseResult> = {}): WsdlParseResult {
  return {
    services: overrides.services ?? [{
      name: "AccountService",
      ports: [{ name: "AccountPort", binding: "AccountBinding", address: "https://siebel.example.com/eai/AccountService" }],
    }],
    operations: overrides.operations ?? [
      { name: "UpsertAccount", inputMessage: "UpsertAccountInput", outputMessage: "UpsertAccountOutput", soapAction: "document/urn:UpsertAccount" },
      { name: "QueryAccount", inputMessage: "QueryAccountInput", outputMessage: "QueryAccountOutput", soapAction: "document/urn:QueryAccount" },
    ],
    types: overrides.types ?? [
      { name: "AccountData", fields: [
        { name: "AccountId", type: "string" },
        { name: "AccountName", type: "string" },
        { name: "Status", type: "string", optional: true },
      ]},
    ],
    messages: overrides.messages ?? [
      { name: "UpsertAccountInput", parts: [{ name: "body", type: "AccountData" }] },
      { name: "UpsertAccountOutput", parts: [{ name: "result", type: "AccountData" }] },
      { name: "QueryAccountInput", parts: [{ name: "body", type: "AccountData" }] },
      { name: "QueryAccountOutput", parts: [{ name: "result", type: "AccountData" }] },
    ],
    metadata: {
      fileName: "AccountService.wsdl",
      targetNamespace: "urn:example",
      operationCount: 2,
      typeCount: 1,
      messageCount: 4,
      parsedAt: new Date().toISOString(),
    },
  };
}

describe("integration-test-gen", () => {
  // AC1: Generate example request payload
  describe("AC1: request payload generation", () => {
    it("should generate example payload for each operation", () => {
      const wsdl = makeWsdl();
      const result = generateIntegrationTests(wsdl);

      expect(result.testCases.length).toBe(2);
      for (const tc of result.testCases) {
        expect(tc.requestPayload).toBeDefined();
        expect(tc.requestPayload).toContain("AccountId");
        expect(tc.requestPayload).toContain("AccountName");
      }
    });

    it("should mark optional fields in payload", () => {
      const wsdl = makeWsdl();
      const result = generateIntegrationTests(wsdl);

      const upsert = result.testCases.find((t) => t.operationName === "UpsertAccount");
      expect(upsert?.requestPayload).toContain("Status");
    });
  });

  // AC2: Generate HTTP test script
  describe("AC2: HTTP test script", () => {
    it("should generate HTTP request per operation", () => {
      const wsdl = makeWsdl();
      const result = generateIntegrationTests(wsdl);

      for (const tc of result.testCases) {
        expect(tc.httpScript).toContain("POST");
        expect(tc.httpScript).toContain(tc.operationName);
        expect(tc.httpScript).toContain("Content-Type");
      }
    });

    it("should include endpoint URL from service", () => {
      const wsdl = makeWsdl();
      const result = generateIntegrationTests(wsdl);

      for (const tc of result.testCases) {
        expect(tc.httpScript).toContain("siebel.example.com");
      }
    });
  });

  // AC3: Response schema validation
  describe("AC3: response schema validation", () => {
    it("should include expected response fields", () => {
      const wsdl = makeWsdl();
      const result = generateIntegrationTests(wsdl);

      for (const tc of result.testCases) {
        expect(tc.expectedResponseFields.length).toBeGreaterThan(0);
        expect(tc.expectedResponseFields.some((f) => f === "AccountId")).toBe(true);
      }
    });
  });

  // AC4: Complete test suite
  describe("AC4: complete test suite per service", () => {
    it("should generate suite metadata", () => {
      const wsdl = makeWsdl();
      const result = generateIntegrationTests(wsdl);

      expect(result.serviceName).toBe("AccountService");
      expect(result.endpointUrl).toContain("siebel.example.com");
      expect(result.testCases.length).toBe(2);
      expect(result.totalOperations).toBe(2);
    });
  });

  // AC5: Inbound and outbound support
  describe("AC5: inbound/outbound support", () => {
    it("should handle inbound service (Upsert pattern)", () => {
      const wsdl = makeWsdl({
        operations: [
          { name: "UpsertAccountV3", inputMessage: "UpsertInput", outputMessage: "UpsertOutput", soapAction: "document/urn:UpsertAccountV3" },
        ],
        messages: [
          { name: "UpsertInput", parts: [{ name: "body", type: "AccountData" }] },
          { name: "UpsertOutput", parts: [{ name: "result", type: "AccountData" }] },
        ],
      });

      const result = generateIntegrationTests(wsdl);

      expect(result.testCases[0].direction).toBe("inbound");
    });

    it("should handle outbound service (Query/Check pattern)", () => {
      const wsdl = makeWsdl({
        operations: [
          { name: "CreditCheckSOAP", inputMessage: "CheckInput", outputMessage: "CheckOutput", soapAction: "document/urn:CreditCheck" },
        ],
        messages: [
          { name: "CheckInput", parts: [{ name: "body", type: "AccountData" }] },
          { name: "CheckOutput", parts: [{ name: "result", type: "AccountData" }] },
        ],
      });

      const result = generateIntegrationTests(wsdl);

      expect(result.testCases[0].direction).toBe("outbound");
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("should handle WSDL with no operations", () => {
      const wsdl = makeWsdl({ operations: [], messages: [] });
      const result = generateIntegrationTests(wsdl);

      expect(result.testCases).toHaveLength(0);
      expect(result.totalOperations).toBe(0);
    });

    it("should handle operation with unknown message type", () => {
      const wsdl = makeWsdl({
        operations: [
          { name: "Unknown", inputMessage: "NonExistent", outputMessage: "NonExistent" },
        ],
      });
      const result = generateIntegrationTests(wsdl);

      expect(result.testCases).toHaveLength(1);
      expect(result.testCases[0].requestPayload).toBeDefined();
    });

    it("should handle empty services", () => {
      const wsdl = makeWsdl({ services: [] });
      const result = generateIntegrationTests(wsdl);

      expect(result.serviceName).toBeDefined();
    });
  });
});
