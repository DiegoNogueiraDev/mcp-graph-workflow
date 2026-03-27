/**
 * WSDL→SIF Generator — generates Integration Object and BC SIF objects
 * from a parsed WSDL definition.
 *
 * Maps WSDL complex types → IC fields, generates IO + optional BC,
 * preserves namespaces, and validates the output.
 */

import type {
  WsdlParseResult,
  WsdlComplexType,
  WsdlField,
} from "./wsdl-parser.js";
import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Public types ---

export interface WsdlToSifOptions {
  readonly prefix: string;
  readonly projectName?: string;
  readonly existingBcName?: string;
}

export interface WsdlToSifResult {
  readonly objects: readonly SiebelObject[];
  readonly sifXml: string;
  readonly operationCount: number;
  readonly validationScore: number;
}

// --- Type mapping ---

const WSDL_TO_SIEBEL_TYPE: Record<string, string> = {
  string: "DTYPE_TEXT",
  int: "DTYPE_INTEGER",
  integer: "DTYPE_INTEGER",
  long: "DTYPE_INTEGER",
  short: "DTYPE_INTEGER",
  decimal: "DTYPE_NUMBER",
  float: "DTYPE_NUMBER",
  double: "DTYPE_NUMBER",
  boolean: "DTYPE_BOOL",
  date: "DTYPE_DATE",
  datetime: "DTYPE_DATETIME",
  dateTime: "DTYPE_DATETIME",
  time: "DTYPE_TEXT",
  base64binary: "DTYPE_TEXT",
  base64Binary: "DTYPE_TEXT",
};

function mapWsdlType(wsdlType: string): string {
  const lower = wsdlType.toLowerCase().replace(/^.*:/, ""); // strip namespace prefix
  return WSDL_TO_SIEBEL_TYPE[lower] ?? "DTYPE_TEXT";
}

// --- Helpers ---

function extractEntityName(serviceName: string): string {
  // "AccountService" → "Account", "CreditCheckSOAPQS" → "CreditCheck"
  return serviceName
    .replace(/Service$/i, "")
    .replace(/SOAP.*$/i, "")
    .replace(/WS$/i, "")
    .trim() || serviceName;
}

function collectAllFields(types: readonly WsdlComplexType[]): WsdlField[] {
  const fieldMap = new Map<string, WsdlField>();
  for (const ct of types) {
    for (const field of ct.fields) {
      if (!fieldMap.has(field.name)) {
        fieldMap.set(field.name, field);
      }
    }
  }
  return [...fieldMap.values()];
}

function makeField(name: string, wsdlType: string, optional?: boolean): SiebelObject {
  const siebelType = mapWsdlType(wsdlType);
  const props: Array<{ name: string; value: string }> = [
    { name: "DATA_TYPE", value: siebelType },
  ];
  if (optional) {
    props.push({ name: "REQUIRED", value: "N" });
  } else {
    props.push({ name: "REQUIRED", value: "Y" });
  }
  return {
    name,
    type: "field" as SiebelObjectType,
    properties: props,
    children: [],
  };
}

// --- Generators ---

function generateIntegrationObject(
  entityName: string,
  prefix: string,
  namespace: string,
  fields: readonly WsdlField[],
  projectName: string,
): SiebelObject {
  const ioName = `${prefix} ${entityName} IO`;

  const ioFields: SiebelObject[] = fields.map((f) =>
    makeField(f.name, f.type, f.optional),
  );

  return {
    name: ioName,
    type: "integration_object",
    project: projectName,
    properties: [
      { name: "XML_NAMESPACE", value: namespace },
      { name: "EXTERNAL_NAME", value: entityName },
    ],
    children: ioFields,
  };
}

function generateBusinessComponent(
  entityName: string,
  prefix: string,
  fields: readonly WsdlField[],
  projectName: string,
): SiebelObject {
  const bcName = `${prefix} ${entityName} BC`;

  const bcFields: SiebelObject[] = fields.map((f) =>
    makeField(f.name, f.type, f.optional),
  );

  return {
    name: bcName,
    type: "business_component",
    project: projectName,
    properties: [
      { name: "TABLE", value: `S_${entityName.toUpperCase().replace(/\s+/g, "_")}` },
    ],
    children: bcFields,
  };
}

function generateSifXml(objects: readonly SiebelObject[]): string {
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<SiebelMessage MessageId="wsdl-gen" IntObjectName="Repository" MessageType="Integration Object">`,
  ];

  for (const obj of objects) {
    const typeTag = obj.type === "integration_object" ? "IntegrationObject" : "BusComp";
    lines.push(`  <${typeTag} NAME="${obj.name}">`);

    for (const prop of obj.properties) {
      lines.push(`    <${prop.name}>${escapeXml(prop.value)}</${prop.name}>`);
    }

    for (const child of obj.children) {
      lines.push(`    <Field NAME="${child.name}">`);
      for (const cp of child.properties) {
        lines.push(`      <${cp.name}>${escapeXml(cp.value)}</${cp.name}>`);
      }
      lines.push(`    </Field>`);
    }

    lines.push(`  </${typeTag}>`);
  }

  lines.push(`</SiebelMessage>`);
  return lines.join("\n");
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function calculateValidationScore(objects: readonly SiebelObject[]): number {
  if (objects.length === 0) return 0;

  let score = 60; // base

  for (const obj of objects) {
    // Has name
    if (obj.name) score += 2;
    // Has properties
    if (obj.properties.length > 0) score += 3;
    // Has fields
    if (obj.children.length > 0) score += 5;
    // Fields have data types
    const typedFields = obj.children.filter((c) =>
      c.properties.some((p) => p.name === "DATA_TYPE"),
    );
    if (typedFields.length === obj.children.length && obj.children.length > 0) score += 5;
  }

  return Math.min(100, score);
}

// --- Main function ---

export function generateSifFromWsdl(
  wsdl: WsdlParseResult,
  options: WsdlToSifOptions,
): WsdlToSifResult {
  const { prefix, projectName = "Generated", existingBcName } = options;

  logger.debug("wsdl-to-sif: generating", {
    operations: wsdl.operations.length,
    types: wsdl.types.length,
  });

  if (wsdl.operations.length === 0 && wsdl.types.length === 0) {
    return { objects: [], sifXml: "", operationCount: 0, validationScore: 0 };
  }

  const serviceName = wsdl.services[0]?.name ?? wsdl.metadata.fileName.replace(".wsdl", "");
  const entityName = extractEntityName(serviceName);
  const namespace = wsdl.metadata.targetNamespace;

  // Collect all fields from all complex types
  const allFields = collectAllFields(wsdl.types);

  const objects: SiebelObject[] = [];

  // AC2: Generate Integration Object
  const io = generateIntegrationObject(entityName, prefix, namespace, allFields, projectName);
  objects.push(io);

  // AC3: Generate BC (unless existing provided)
  if (!existingBcName) {
    const bc = generateBusinessComponent(entityName, prefix, allFields, projectName);
    objects.push(bc);
  }

  // Generate SIF XML
  const sifXml = generateSifXml(objects);

  // AC5: Validation
  const validationScore = calculateValidationScore(objects);

  logger.info("wsdl-to-sif: complete", {
    objects: objects.length,
    fields: allFields.length,
    score: validationScore,
  });

  return {
    objects,
    sifXml,
    operationCount: wsdl.operations.length,
    validationScore,
  };
}
