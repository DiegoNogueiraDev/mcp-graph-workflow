import { describe, it, expect } from "vitest";
import {
  generateSifFromWsdl,
  type WsdlToSifResult,
} from "../../core/siebel/wsdl-to-sif.js";
import type { WsdlParseResult } from "../../core/siebel/wsdl-parser.js";

// --- Factory ---

function makeWsdl(overrides: Partial<WsdlParseResult> = {}): WsdlParseResult {
  return {
    services: overrides.services ?? [{
      name: "AccountService",
      ports: [{ name: "AccountPort", binding: "AccountBinding", address: "https://siebel.example.com/eai" }],
    }],
    operations: overrides.operations ?? [
      { name: "Upsert", inputMessage: "UpsertInput", outputMessage: "UpsertOutput" },
    ],
    types: overrides.types ?? [
      { name: "AccountData", fields: [
        { name: "AccountId", type: "string" },
        { name: "AccountName", type: "string" },
        { name: "Status", type: "string", optional: true },
        { name: "Revenue", type: "decimal" },
      ]},
    ],
    messages: overrides.messages ?? [
      { name: "UpsertInput", parts: [{ name: "body", type: "AccountData" }] },
      { name: "UpsertOutput", parts: [{ name: "result", type: "AccountData" }] },
    ],
    metadata: {
      fileName: "AccountService.wsdl",
      targetNamespace: "urn:example",
      operationCount: 1,
      typeCount: 1,
      messageCount: 2,
      parsedAt: new Date().toISOString(),
    },
  };
}

describe("wsdl-to-sif", () => {
  // AC1: Extract operations and types
  describe("AC1: extract operations and types", () => {
    it("should generate objects from WSDL operations and types", () => {
      const wsdl = makeWsdl();
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      expect(result.objects.length).toBeGreaterThan(0);
      expect(result.operationCount).toBe(1);
    });
  });

  // AC2: Generate Integration Object with IC fields
  describe("AC2: Integration Object generation", () => {
    it("should generate Integration Object with fields from WSDL types", () => {
      const wsdl = makeWsdl();
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      const io = result.objects.find((o) => o.type === "integration_object");
      expect(io).toBeDefined();
      expect(io!.name).toContain("Account");

      // Should have IC fields as children
      const fields = io!.children.filter((c) => c.type === "field");
      expect(fields.length).toBeGreaterThanOrEqual(4);
      expect(fields.some((f) => f.name === "AccountId")).toBe(true);
      expect(fields.some((f) => f.name === "AccountName")).toBe(true);
    });
  });

  // AC3: Generate BC with fields
  describe("AC3: BC generation", () => {
    it("should generate BC with fields mapped from WSDL types", () => {
      const wsdl = makeWsdl();
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      const bc = result.objects.find((o) => o.type === "business_component");
      expect(bc).toBeDefined();

      const fields = bc!.children.filter((c) => c.type === "field");
      expect(fields.length).toBeGreaterThanOrEqual(4);
    });

    it("should skip BC generation if existingBcName is provided", () => {
      const wsdl = makeWsdl();
      const result = generateSifFromWsdl(wsdl, {
        prefix: "CX",
        existingBcName: "CX Account BC",
      });

      const bcs = result.objects.filter((o) => o.type === "business_component");
      expect(bcs).toHaveLength(0);
    });
  });

  // AC4: Correct namespaces and types
  describe("AC4: namespaces and type mapping", () => {
    it("should map WSDL types to Siebel field types", () => {
      const wsdl = makeWsdl();
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      const io = result.objects.find((o) => o.type === "integration_object");
      const fields = io?.children.filter((c) => c.type === "field") ?? [];

      // string → DTYPE_TEXT, decimal → DTYPE_NUMBER
      const accountId = fields.find((f) => f.name === "AccountId");
      expect(accountId?.properties.some((p) => p.name === "DATA_TYPE" && p.value === "DTYPE_TEXT")).toBe(true);

      const revenue = fields.find((f) => f.name === "Revenue");
      expect(revenue?.properties.some((p) => p.name === "DATA_TYPE" && p.value === "DTYPE_NUMBER")).toBe(true);
    });

    it("should include namespace in IO metadata", () => {
      const wsdl = makeWsdl();
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      const io = result.objects.find((o) => o.type === "integration_object");
      expect(io?.properties.some((p) => p.name === "XML_NAMESPACE" && p.value.includes("urn:example"))).toBe(true);
    });
  });

  // AC5: Validation score
  describe("AC5: validation score ≥80", () => {
    it("should produce validation score of at least 80", () => {
      const wsdl = makeWsdl();
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      expect(result.validationScore).toBeGreaterThanOrEqual(80);
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("should handle WSDL with no types (only messages)", () => {
      const wsdl = makeWsdl({ types: [] });
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      expect(result.objects.length).toBeGreaterThanOrEqual(1); // at least IO
    });

    it("should handle WSDL with multiple complex types", () => {
      const wsdl = makeWsdl({
        types: [
          { name: "OrderHeader", fields: [
            { name: "OrderId", type: "string" },
            { name: "OrderDate", type: "dateTime" },
          ]},
          { name: "OrderItem", fields: [
            { name: "ItemId", type: "string" },
            { name: "Quantity", type: "int" },
          ]},
        ],
      });
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      const io = result.objects.find((o) => o.type === "integration_object");
      // Should include fields from all types
      const fields = io?.children.filter((c) => c.type === "field") ?? [];
      expect(fields.some((f) => f.name === "OrderId")).toBe(true);
      expect(fields.some((f) => f.name === "ItemId")).toBe(true);
    });

    it("should handle empty WSDL", () => {
      const wsdl = makeWsdl({ operations: [], types: [], messages: [], services: [] });
      const result = generateSifFromWsdl(wsdl, { prefix: "CX" });

      expect(result.objects).toHaveLength(0);
      expect(result.validationScore).toBeDefined();
    });
  });
});
