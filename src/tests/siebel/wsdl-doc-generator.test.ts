import { describe, it, expect } from "vitest";
import { generateWsdlDocumentation } from "../../core/siebel/wsdl-doc-generator.js";
import type { WsdlParseResult } from "../../core/siebel/wsdl-parser.js";

function makeWsdl(): WsdlParseResult {
  return {
    services: [{ name: "AccountService", ports: [{ name: "AccountPort", binding: "AccountBinding", address: "http://example.com/ws" }] }],
    operations: [
      { name: "UpsertAccount", inputMessage: "UpsertAccountRequest", outputMessage: "UpsertAccountResponse", soapAction: "urn:UpsertAccount" },
      { name: "GetAssets", inputMessage: "GetAssetsRequest", outputMessage: "GetAssetsResponse" },
    ],
    types: [
      { name: "UpsertAccountRequest", fields: [
        { name: "accountName", type: "string" },
        { name: "status", type: "string", optional: true },
      ]},
      { name: "UpsertAccountResponse", fields: [
        { name: "accountId", type: "string" },
      ]},
      { name: "GetAssetsRequest", fields: [
        { name: "customerId", type: "string" },
      ]},
      { name: "GetAssetsResponse", fields: [
        { name: "assets", type: "AssetItem", isArray: true },
      ]},
      { name: "AssetItem", fields: [
        { name: "assetName", type: "string" },
        { name: "serialNumber", type: "string" },
      ]},
    ],
    messages: [
      { name: "UpsertAccountRequest", parts: [{ name: "parameters", type: "UpsertAccountRequest" }] },
      { name: "UpsertAccountResponse", parts: [{ name: "parameters", type: "UpsertAccountResponse" }] },
      { name: "GetAssetsRequest", parts: [{ name: "parameters", type: "GetAssetsRequest" }] },
      { name: "GetAssetsResponse", parts: [{ name: "parameters", type: "GetAssetsResponse" }] },
    ],
    metadata: { fileName: "AccountService.wsdl", targetNamespace: "urn:acme:account", operationCount: 2, typeCount: 5, messageCount: 4, parsedAt: "2026-01-01T00:00:00Z" },
  };
}

describe("generateWsdlDocumentation", () => {
  it("should generate markdown with service name as title", () => {
    const doc = generateWsdlDocumentation(makeWsdl());

    expect(doc).toContain("# AccountService");
  });

  it("should include namespace and endpoint", () => {
    const doc = generateWsdlDocumentation(makeWsdl());

    expect(doc).toContain("urn:acme:account");
    expect(doc).toContain("http://example.com/ws");
  });

  it("should list operations in a table", () => {
    const doc = generateWsdlDocumentation(makeWsdl());

    expect(doc).toContain("UpsertAccount");
    expect(doc).toContain("GetAssets");
    expect(doc).toContain("| Operation");
  });

  it("should include input/output fields per operation", () => {
    const doc = generateWsdlDocumentation(makeWsdl());

    expect(doc).toContain("accountName");
    expect(doc).toContain("accountId");
    expect(doc).toContain("customerId");
  });

  it("should mark optional fields", () => {
    const doc = generateWsdlDocumentation(makeWsdl());

    // status is optional in UpsertAccountRequest
    expect(doc).toMatch(/status.*optional/i);
  });

  it("should mark array fields", () => {
    const doc = generateWsdlDocumentation(makeWsdl());

    expect(doc).toMatch(/assets.*\[\]/);
  });

  it("should include Mermaid sequence diagram per operation", () => {
    const doc = generateWsdlDocumentation(makeWsdl());

    expect(doc).toContain("```mermaid");
    expect(doc).toContain("sequenceDiagram");
    expect(doc).toContain("UpsertAccount");
  });

  it("should handle WSDL with no operations", () => {
    const wsdl = makeWsdl();
    wsdl.operations = [];
    wsdl.types = [];

    const doc = generateWsdlDocumentation(wsdl);

    expect(doc).toContain("# AccountService");
    expect(doc).toContain("No operations");
  });
});
