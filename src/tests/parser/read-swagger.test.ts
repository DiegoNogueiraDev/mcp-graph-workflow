import { describe, it, expect } from "vitest";
import {
  parseSwaggerContent,
  parseWsdlContent,
} from "../../core/parser/read-swagger.js";

const OPENAPI3_YAML = `
openapi: "3.0.3"
info:
  title: Account API
  version: "1.0.0"
  description: Siebel Account REST endpoints
paths:
  /accounts:
    get:
      summary: List accounts
      operationId: listAccounts
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: List of accounts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Account"
    post:
      summary: Create account
      operationId: createAccount
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Account"
      responses:
        "201":
          description: Created
  /accounts/{id}:
    get:
      summary: Get account by ID
      operationId: getAccount
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Account details
components:
  schemas:
    Account:
      type: object
      required:
        - name
      properties:
        name:
          type: string
        location:
          type: string
        status:
          type: string
          enum: [Active, Inactive]
    Contact:
      type: object
      properties:
        firstName:
          type: string
        lastName:
          type: string
`;

const OPENAPI2_JSON = JSON.stringify({
  swagger: "2.0",
  info: { title: "Order API", version: "2.0.0" },
  basePath: "/api",
  paths: {
    "/orders": {
      get: {
        summary: "List orders",
        operationId: "listOrders",
        responses: { "200": { description: "OK" } },
      },
    },
  },
  definitions: {
    Order: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        amount: { type: "number" },
      },
    },
  },
});

const WSDL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="AccountService"
  targetNamespace="http://siebel.com/AccountService"
  xmlns="http://schemas.xmlsoap.org/wsdl/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:tns="http://siebel.com/AccountService"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">

  <types>
    <xsd:schema>
      <xsd:element name="AccountRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Name" type="xsd:string"/>
            <xsd:element name="Location" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="AccountResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Id" type="xsd:string"/>
            <xsd:element name="Status" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>

  <message name="CreateAccountInput">
    <part name="parameters" element="tns:AccountRequest"/>
  </message>
  <message name="CreateAccountOutput">
    <part name="parameters" element="tns:AccountResponse"/>
  </message>
  <message name="GetAccountInput">
    <part name="accountId" type="xsd:string"/>
  </message>
  <message name="GetAccountOutput">
    <part name="parameters" element="tns:AccountResponse"/>
  </message>

  <portType name="AccountPortType">
    <operation name="CreateAccount">
      <input message="tns:CreateAccountInput"/>
      <output message="tns:CreateAccountOutput"/>
    </operation>
    <operation name="GetAccount">
      <input message="tns:GetAccountInput"/>
      <output message="tns:GetAccountOutput"/>
    </operation>
  </portType>

  <binding name="AccountBinding" type="tns:AccountPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="CreateAccount">
      <soap:operation soapAction="CreateAccount"/>
    </operation>
    <operation name="GetAccount">
      <soap:operation soapAction="GetAccount"/>
    </operation>
  </binding>

  <service name="AccountService">
    <port name="AccountPort" binding="tns:AccountBinding">
      <soap:address location="http://siebel.example.com/ws/AccountService"/>
    </port>
  </service>
</definitions>`;

describe("read-swagger", () => {
  describe("parseSwaggerContent — OpenAPI 3.0 YAML", () => {
    it("should parse title, version, and format", () => {
      const result = parseSwaggerContent(OPENAPI3_YAML);
      expect(result.title).toBe("Account API");
      expect(result.version).toBe("1.0.0");
      expect(result.format).toBe("openapi3");
    });

    it("should extract all endpoints", () => {
      const result = parseSwaggerContent(OPENAPI3_YAML);
      expect(result.endpoints.length).toBe(3);

      const listEndpoint = result.endpoints.find((e) => e.operationId === "listAccounts");
      expect(listEndpoint).toBeDefined();
      expect(listEndpoint!.method).toBe("GET");
      expect(listEndpoint!.path).toBe("/accounts");
      expect(listEndpoint!.summary).toBe("List accounts");
      expect(listEndpoint!.parameters.length).toBe(1);
      expect(listEndpoint!.parameters[0].name).toBe("limit");

      const createEndpoint = result.endpoints.find((e) => e.operationId === "createAccount");
      expect(createEndpoint).toBeDefined();
      expect(createEndpoint!.method).toBe("POST");
    });

    it("should extract component schemas", () => {
      const result = parseSwaggerContent(OPENAPI3_YAML);
      expect(result.schemas.length).toBe(2);

      const accountSchema = result.schemas.find((s) => s.name === "Account");
      expect(accountSchema).toBeDefined();
      expect(accountSchema!.properties.length).toBe(3);
      expect(accountSchema!.required).toContain("name");

      const contactSchema = result.schemas.find((s) => s.name === "Contact");
      expect(contactSchema).toBeDefined();
      expect(contactSchema!.properties.length).toBe(2);
    });
  });

  describe("parseSwaggerContent — OpenAPI 2.0 JSON", () => {
    it("should parse Swagger 2.0 JSON", () => {
      const result = parseSwaggerContent(OPENAPI2_JSON);
      expect(result.title).toBe("Order API");
      expect(result.version).toBe("2.0.0");
      expect(result.format).toBe("openapi2");
    });

    it("should extract endpoints from Swagger 2.0", () => {
      const result = parseSwaggerContent(OPENAPI2_JSON);
      expect(result.endpoints.length).toBe(1);
      expect(result.endpoints[0].method).toBe("GET");
      expect(result.endpoints[0].path).toBe("/orders");
    });

    it("should extract definitions as schemas from Swagger 2.0", () => {
      const result = parseSwaggerContent(OPENAPI2_JSON);
      expect(result.schemas.length).toBe(1);
      expect(result.schemas[0].name).toBe("Order");
      expect(result.schemas[0].properties.length).toBe(2);
    });
  });

  describe("parseSwaggerContent — error handling", () => {
    it("should throw on empty content", () => {
      expect(() => parseSwaggerContent("")).toThrow();
    });

    it("should throw on unrecognized format", () => {
      expect(() => parseSwaggerContent("just plain text")).toThrow();
    });
  });

  describe("parseWsdlContent", () => {
    it("should parse WSDL service name and format", () => {
      const result = parseWsdlContent(WSDL_XML);
      expect(result.title).toBe("AccountService");
      expect(result.format).toBe("wsdl");
    });

    it("should extract operations as endpoints", () => {
      const result = parseWsdlContent(WSDL_XML);
      expect(result.endpoints.length).toBe(2);

      const createOp = result.endpoints.find((e) => e.operationId === "CreateAccount");
      expect(createOp).toBeDefined();
      expect(createOp!.method).toBe("SOAP");
      expect(createOp!.path).toBe("CreateAccount");

      const getOp = result.endpoints.find((e) => e.operationId === "GetAccount");
      expect(getOp).toBeDefined();
    });

    it("should extract schema elements from types", () => {
      const result = parseWsdlContent(WSDL_XML);
      expect(result.schemas.length).toBeGreaterThanOrEqual(2);

      const reqSchema = result.schemas.find((s) => s.name === "AccountRequest");
      expect(reqSchema).toBeDefined();
      expect(reqSchema!.properties.length).toBe(2);
    });

    it("should throw on invalid XML", () => {
      expect(() => parseWsdlContent("not xml")).toThrow();
    });
  });
});
