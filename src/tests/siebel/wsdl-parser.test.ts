import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWsdlContent } from "../../core/siebel/wsdl-parser.js";

const FIXTURE_PATH = join(import.meta.dirname, "../fixtures/sample.wsdl");
const WSDL_CONTENT = readFileSync(FIXTURE_PATH, "utf-8");

describe("wsdl-parser", () => {
  it("should extract service name", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    expect(result.services.length).toBe(1);
    expect(result.services[0].name).toBe("AccountWebService");
  });

  it("should extract port with endpoint URL", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    const port = result.services[0].ports[0];
    expect(port.name).toBe("AccountPort");
    expect(port.binding).toBe("AccountBinding");
    expect(port.address).toContain("siebel.example.com");
  });

  it("should extract operations from portType", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    expect(result.operations.length).toBe(2);

    const upsert = result.operations.find((o) => o.name === "UpsertAccount");
    expect(upsert).toBeDefined();
    expect(upsert!.inputMessage).toBe("UpsertAccountInput");
    expect(upsert!.outputMessage).toBe("UpsertAccountOutput");

    const getAssets = result.operations.find((o) => o.name === "GetCustomerAssets");
    expect(getAssets).toBeDefined();
  });

  it("should extract complex types from schema", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    expect(result.types.length).toBeGreaterThanOrEqual(3);

    const accountReq = result.types.find((t) => t.name === "AccountRequest");
    expect(accountReq).toBeDefined();
    expect(accountReq!.fields.length).toBe(4);

    const nameField = accountReq!.fields.find((f) => f.name === "Name");
    expect(nameField).toBeDefined();
    expect(nameField!.type).toBe("xsd:string");
  });

  it("should extract nested complex type references", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    const accountReq = result.types.find((t) => t.name === "AccountRequest");
    const addressField = accountReq!.fields.find((f) => f.name === "Address");
    expect(addressField).toBeDefined();
    expect(addressField!.type).toContain("AddressType");
  });

  it("should extract messages with parts", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    expect(result.messages.length).toBe(4);

    const input = result.messages.find((m) => m.name === "UpsertAccountInput");
    expect(input).toBeDefined();
    expect(input!.parts.length).toBe(1);
    expect(input!.parts[0].type).toContain("AccountRequest");
  });

  it("should capture metadata", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    expect(result.metadata.fileName).toBe("sample.wsdl");
    expect(result.metadata.targetNamespace).toContain("example.com");
    expect(result.metadata.operationCount).toBe(2);
    expect(result.metadata.typeCount).toBeGreaterThanOrEqual(3);
  });

  it("should handle field minOccurs/maxOccurs", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    const accountReq = result.types.find((t) => t.name === "AccountRequest");
    const statusField = accountReq!.fields.find((f) => f.name === "Status");
    expect(statusField!.optional).toBe(true);

    const nameField = accountReq!.fields.find((f) => f.name === "Name");
    expect(nameField!.optional).toBeFalsy();
  });

  it("should detect array fields via maxOccurs=unbounded", () => {
    const result = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    const response = result.types.find((t) => t.name === "AssetListResponse");
    expect(response).toBeDefined();

    const assetsField = response!.fields.find((f) => f.name === "Assets");
    expect(assetsField!.isArray).toBe(true);
  });

  it("should throw on invalid XML", () => {
    expect(() => parseWsdlContent("not xml", "bad.wsdl")).toThrow();
  });

  it("should throw on non-WSDL XML", () => {
    expect(() => parseWsdlContent("<root><item/></root>", "notawsdl.wsdl")).toThrow();
  });
});
