/**
 * WSDL Parser — extracts services, operations, types, and messages from WSDL files.
 * Uses fast-xml-parser (ADR-001: no new dependencies).
 */

import { XMLParser } from "fast-xml-parser";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";

// ---- Result types ----

export interface WsdlField {
  name: string;
  type: string;
  optional?: boolean;
  isArray?: boolean;
}

export interface WsdlComplexType {
  name: string;
  fields: WsdlField[];
}

export interface WsdlMessagePart {
  name: string;
  type: string;
}

export interface WsdlMessage {
  name: string;
  parts: WsdlMessagePart[];
}

export interface WsdlOperation {
  name: string;
  inputMessage: string;
  outputMessage: string;
  soapAction?: string;
}

export interface WsdlPort {
  name: string;
  binding: string;
  address: string;
}

export interface WsdlService {
  name: string;
  ports: WsdlPort[];
}

export interface WsdlMetadata {
  fileName: string;
  targetNamespace: string;
  operationCount: number;
  typeCount: number;
  messageCount: number;
  parsedAt: string;
}

export interface WsdlParseResult {
  services: WsdlService[];
  operations: WsdlOperation[];
  types: WsdlComplexType[];
  messages: WsdlMessage[];
  metadata: WsdlMetadata;
}

// ---- Parser ----

const WSDL_DEFINITIONS_KEYS = ["definitions", "wsdl:definitions"];
const WSDL_TYPES_KEYS = ["types", "wsdl:types"];
const _WSDL_MESSAGE_KEYS = ["message", "wsdl:message"];
const _WSDL_PORT_TYPE_KEYS = ["portType", "wsdl:portType"];
const _WSDL_SERVICE_KEYS = ["service", "wsdl:service"];

/**
 * Parse WSDL XML content into structured result.
 */
export function parseWsdlContent(content: string, fileName: string): WsdlParseResult {
  if (!content || content.trim().length === 0) {
    throw new ValidationError("WSDL content is empty", [{ field: "content", message: "empty" }]);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: false,
    isArray: (name) => {
      const arrayTags = new Set([
        "operation", "wsdl:operation",
        "message", "wsdl:message",
        "part", "wsdl:part",
        "port", "wsdl:port",
        "service", "wsdl:service",
        "portType", "wsdl:portType",
        "xsd:element", "element",
        "xsd:complexType", "complexType",
      ]);
      return arrayTags.has(name);
    },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(content) as Record<string, unknown>;
  } catch (err) {
    throw new ValidationError("Invalid WSDL XML", [
      { field: "xml", message: err instanceof Error ? err.message : String(err) },
    ]);
  }

  const definitions = findKey(parsed, WSDL_DEFINITIONS_KEYS) as Record<string, unknown> | undefined;
  if (!definitions) {
    throw new ValidationError("WSDL missing definitions root element", [
      { field: "structure", message: "no definitions found" },
    ]);
  }

  const targetNamespace = getAttr(definitions, "targetNamespace") ?? "";

  const types = extractTypes(definitions);
  const messages = extractMessages(definitions);
  const operations = extractOperations(definitions);
  const services = extractServices(definitions);

  const metadata: WsdlMetadata = {
    fileName,
    targetNamespace,
    operationCount: operations.length,
    typeCount: types.length,
    messageCount: messages.length,
    parsedAt: new Date().toISOString(),
  };

  logger.info("WSDL parsed", {
    fileName,
    operations: String(operations.length),
    types: String(types.length),
    services: String(services.length),
  });

  return { services, operations, types, messages, metadata };
}

// ---- Extraction helpers ----

function extractTypes(definitions: Record<string, unknown>): WsdlComplexType[] {
  const types: WsdlComplexType[] = [];
  const typesNode = findKey(definitions, WSDL_TYPES_KEYS) as Record<string, unknown> | undefined;
  if (!typesNode) return types;

  const schema = findKey(typesNode, ["xsd:schema", "schema", "xs:schema"]) as Record<string, unknown> | undefined;
  if (!schema) return types;

  const complexTypes = getArray(schema, "xsd:complexType") ?? getArray(schema, "complexType") ?? getArray(schema, "xs:complexType");

  for (const ct of complexTypes) {
    const ctObj = ct as Record<string, unknown>;
    const name = getAttr(ctObj, "name");
    if (!name) continue;

    const fields = extractFields(ctObj);
    types.push({ name, fields });
  }

  return types;
}

function extractFields(complexType: Record<string, unknown>): WsdlField[] {
  const fields: WsdlField[] = [];
  const sequence = findKey(complexType, ["xsd:sequence", "sequence", "xs:sequence"]) as Record<string, unknown> | undefined;
  if (!sequence) return fields;

  const elements = getArray(sequence, "xsd:element") ?? getArray(sequence, "element") ?? getArray(sequence, "xs:element");

  for (const elem of elements) {
    const el = elem as Record<string, unknown>;
    const name = getAttr(el, "name");
    if (!name) continue;

    const type = getAttr(el, "type") ?? "xsd:string";
    const minOccurs = getAttr(el, "minOccurs");
    const maxOccurs = getAttr(el, "maxOccurs");

    fields.push({
      name,
      type,
      optional: minOccurs === "0" || undefined,
      isArray: maxOccurs === "unbounded" || undefined,
    });
  }

  return fields;
}

function extractMessages(definitions: Record<string, unknown>): WsdlMessage[] {
  const messages: WsdlMessage[] = [];
  const msgElements = getArray(definitions, "message") ?? getArray(definitions, "wsdl:message");

  for (const msg of msgElements) {
    const msgObj = msg as Record<string, unknown>;
    const name = getAttr(msgObj, "name");
    if (!name) continue;

    const partElements = getArray(msgObj, "part") ?? getArray(msgObj, "wsdl:part");
    const parts: WsdlMessagePart[] = [];

    for (const p of partElements) {
      const pObj = p as Record<string, unknown>;
      const partName = getAttr(pObj, "name") ?? "parameters";
      const partType = getAttr(pObj, "type") ?? getAttr(pObj, "element") ?? "";
      parts.push({ name: partName, type: partType });
    }

    messages.push({ name, parts });
  }

  return messages;
}

function extractOperations(definitions: Record<string, unknown>): WsdlOperation[] {
  const operations: WsdlOperation[] = [];
  const portTypes = getArray(definitions, "portType") ?? getArray(definitions, "wsdl:portType");

  for (const pt of portTypes) {
    const ptObj = pt as Record<string, unknown>;
    const ops = getArray(ptObj, "operation") ?? getArray(ptObj, "wsdl:operation");

    for (const op of ops) {
      const opObj = op as Record<string, unknown>;
      const name = getAttr(opObj, "name");
      if (!name) continue;

      const input = (findKey(opObj, ["input", "wsdl:input"]) ?? {}) as Record<string, unknown>;
      const output = (findKey(opObj, ["output", "wsdl:output"]) ?? {}) as Record<string, unknown>;

      const inputMsg = stripNamespace(getAttr(input, "message") ?? "");
      const outputMsg = stripNamespace(getAttr(output, "message") ?? "");

      operations.push({
        name,
        inputMessage: inputMsg,
        outputMessage: outputMsg,
      });
    }
  }

  // Enrich with soapAction from binding
  const bindings = getArray(definitions, "binding") ?? getArray(definitions, "wsdl:binding");
  for (const b of bindings) {
    const bObj = b as Record<string, unknown>;
    const bindOps = getArray(bObj, "operation") ?? getArray(bObj, "wsdl:operation");
    for (const bo of bindOps) {
      const boObj = bo as Record<string, unknown>;
      const opName = getAttr(boObj, "name");
      const soapOp = findKey(boObj, ["soap:operation", "soap12:operation"]) as Record<string, unknown> | undefined;
      if (opName && soapOp) {
        const action = getAttr(soapOp, "soapAction");
        const matchOp = operations.find((o) => o.name === opName);
        if (matchOp && action) {
          matchOp.soapAction = action;
        }
      }
    }
  }

  return operations;
}

function extractServices(definitions: Record<string, unknown>): WsdlService[] {
  const services: WsdlService[] = [];
  const svcElements = getArray(definitions, "service") ?? getArray(definitions, "wsdl:service");

  for (const svc of svcElements) {
    const svcObj = svc as Record<string, unknown>;
    const name = getAttr(svcObj, "name");
    if (!name) continue;

    const portElements = getArray(svcObj, "port") ?? getArray(svcObj, "wsdl:port");
    const ports: WsdlPort[] = [];

    for (const p of portElements) {
      const pObj = p as Record<string, unknown>;
      const portName = getAttr(pObj, "name") ?? "";
      const binding = stripNamespace(getAttr(pObj, "binding") ?? "");
      const soapAddr = findKey(pObj, ["soap:address", "soap12:address"]) as Record<string, unknown> | undefined;
      const address = soapAddr ? (getAttr(soapAddr, "location") ?? "") : "";

      ports.push({ name: portName, binding, address });
    }

    services.push({ name, ports });
  }

  return services;
}

// ---- Utility helpers ----

function getAttr(obj: Record<string, unknown>, name: string): string | undefined {
  const val = obj[`@_${name}`];
  return val != null ? String(val) : undefined;
}

function getArray(obj: Record<string, unknown>, key: string): unknown[] {
  const val = obj[key];
  if (Array.isArray(val)) return val;
  if (val != null) return [val];
  return [];
}

function findKey(obj: Record<string, unknown>, keys: string[]): unknown | undefined {
  for (const key of keys) {
    if (obj[key] != null) return obj[key];
  }
  return undefined;
}

function stripNamespace(qname: string): string {
  const idx = qname.indexOf(":");
  return idx >= 0 ? qname.slice(idx + 1) : qname;
}
