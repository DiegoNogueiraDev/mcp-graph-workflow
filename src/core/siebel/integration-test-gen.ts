/**
 * Integration Test Generator — generates HTTP test scripts from WSDL definitions.
 *
 * For each WSDL operation, generates:
 * - Example SOAP request payload
 * - HTTP test script (curl/fetch style)
 * - Expected response fields for validation
 * - Direction detection (inbound vs outbound)
 */

import type {
  WsdlParseResult,
  WsdlComplexType,
  WsdlMessage,
  WsdlField,
} from "./wsdl-parser.js";
import { logger } from "../utils/logger.js";

// --- Public types ---

export interface IntegrationTestCase {
  readonly operationName: string;
  readonly direction: "inbound" | "outbound";
  readonly soapAction: string;
  readonly requestPayload: string;
  readonly httpScript: string;
  readonly expectedResponseFields: readonly string[];
}

export interface IntegrationTestSuite {
  readonly serviceName: string;
  readonly endpointUrl: string;
  readonly totalOperations: number;
  readonly testCases: readonly IntegrationTestCase[];
}

// --- Helpers ---

const INBOUND_PATTERNS = /upsert|insert|update|create|delete|sync|import|write|save/i;
const OUTBOUND_PATTERNS = /query|check|get|fetch|read|search|lookup|validate|verify|export/i;

function detectDirection(operationName: string): "inbound" | "outbound" {
  if (INBOUND_PATTERNS.test(operationName)) return "inbound";
  if (OUTBOUND_PATTERNS.test(operationName)) return "outbound";
  // Default: if name contains "WS" suffix or "Service" it's typically inbound
  return INBOUND_PATTERNS.test(operationName) ? "inbound" : "outbound";
}

function findMessageType(
  messageName: string,
  messages: readonly WsdlMessage[],
): WsdlMessage | undefined {
  return messages.find((m) => m.name === messageName);
}

function findComplexType(
  typeName: string,
  types: readonly WsdlComplexType[],
): WsdlComplexType | undefined {
  return types.find((t) => t.name === typeName);
}

function resolveFields(
  message: WsdlMessage | undefined,
  types: readonly WsdlComplexType[],
): WsdlField[] {
  if (!message || message.parts.length === 0) return [];

  // Try to resolve through parts → complex types
  for (const part of message.parts) {
    const ct = findComplexType(part.type, types);
    if (ct) return ct.fields;
  }

  // Fallback: create fields from part names
  return message.parts.map((p) => ({
    name: p.name,
    type: p.type,
  }));
}

function generateSampleValue(field: WsdlField): string {
  const lower = field.type.toLowerCase();
  if (lower.includes("int") || lower.includes("number") || lower.includes("decimal")) {
    return "12345";
  }
  if (lower.includes("bool")) return "true";
  if (lower.includes("date")) return "2026-01-01T00:00:00Z";
  return `sample_${field.name}`;
}

function buildXmlPayload(
  operationName: string,
  fields: readonly WsdlField[],
  namespace: string,
): string {
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${namespace}">`,
    `  <soapenv:Header/>`,
    `  <soapenv:Body>`,
    `    <ns:${operationName}>`,
  ];

  for (const field of fields) {
    const value = generateSampleValue(field);
    const comment = field.optional ? " <!-- optional -->" : "";
    lines.push(`      <ns:${field.name}>${value}</ns:${field.name}>${comment}`);
  }

  lines.push(
    `    </ns:${operationName}>`,
    `  </soapenv:Body>`,
    `</soapenv:Envelope>`,
  );

  return lines.join("\n");
}

function buildHttpScript(
  operationName: string,
  endpointUrl: string,
  soapAction: string,
  payload: string,
): string {
  const lines: string[] = [
    `# Test: ${operationName}`,
    `# Method: POST`,
    `# Endpoint: ${endpointUrl}`,
    ``,
    `curl -X POST "${endpointUrl}" \\`,
    `  -H "Content-Type: text/xml; charset=UTF-8" \\`,
    `  -H "SOAPAction: ${soapAction}" \\`,
    `  -d '${payload.replace(/'/g, "\\'")}'`,
    ``,
    `# Expected: HTTP 200 with SOAP response`,
    `# Validate: response contains ${operationName} result fields`,
  ];

  return lines.join("\n");
}

// --- Main function ---

export function generateIntegrationTests(wsdl: WsdlParseResult): IntegrationTestSuite {
  logger.debug("integration-test-gen: generating", {
    operations: wsdl.operations.length,
    types: wsdl.types.length,
  });

  const serviceName = wsdl.services[0]?.name ?? wsdl.metadata.fileName.replace(".wsdl", "");
  const endpointUrl = wsdl.services[0]?.ports[0]?.address ?? "https://siebel.example.com/eai/service";
  const namespace = wsdl.metadata.targetNamespace;

  const testCases: IntegrationTestCase[] = [];

  for (const op of wsdl.operations) {
    const direction = detectDirection(op.name);
    const soapAction = op.soapAction ?? `document/urn:${op.name}`;

    // Resolve input fields
    const inputMsg = findMessageType(op.inputMessage, wsdl.messages);
    const inputFields = resolveFields(inputMsg, wsdl.types);

    // Resolve output fields for validation
    const outputMsg = findMessageType(op.outputMessage, wsdl.messages);
    const outputFields = resolveFields(outputMsg, wsdl.types);

    // Build payload
    const payload = buildXmlPayload(op.name, inputFields, namespace);

    // Build HTTP script
    const httpScript = buildHttpScript(op.name, endpointUrl, soapAction, payload);

    // Expected response fields
    const expectedResponseFields = outputFields.map((f) => f.name);

    testCases.push({
      operationName: op.name,
      direction,
      soapAction,
      requestPayload: payload,
      httpScript,
      expectedResponseFields,
    });
  }

  logger.info("integration-test-gen: complete", {
    service: serviceName,
    testCases: testCases.length,
  });

  return {
    serviceName,
    endpointUrl,
    totalOperations: wsdl.operations.length,
    testCases,
  };
}
