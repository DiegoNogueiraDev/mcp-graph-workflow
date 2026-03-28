/**
 * WSDL Documentation Generator — generates Markdown documentation from parsed WSDL.
 * Includes operation tables, field details, and Mermaid sequence diagrams.
 */

import type { WsdlParseResult, WsdlField } from "./wsdl-parser.js";
import { logger } from "../utils/logger.js";

function formatFieldType(field: WsdlField): string {
  const base = field.type;
  if (field.isArray) return `${base}[]`;
  return base;
}

function formatFieldFlags(field: WsdlField): string {
  const flags: string[] = [];
  if (field.optional) flags.push("optional");
  return flags.join(", ");
}

function renderFieldsTable(fields: WsdlField[]): string {
  if (fields.length === 0) return "_No fields_\n";

  const lines: string[] = [];
  lines.push("| Field | Type | Flags |");
  lines.push("|-------|------|-------|");
  for (const f of fields) {
    lines.push(`| ${f.name} | \`${formatFieldType(f)}\` | ${formatFieldFlags(f)} |`);
  }
  return lines.join("\n") + "\n";
}

function renderSequenceDiagram(operationName: string, serviceName: string, soapAction?: string): string {
  const lines: string[] = [];
  lines.push("```mermaid");
  lines.push("sequenceDiagram");
  lines.push(`    participant Client`);
  lines.push(`    participant ${serviceName}`);
  lines.push(`    Client->>+${serviceName}: ${operationName}(request)`);
  if (soapAction) {
    lines.push(`    Note right of ${serviceName}: SOAPAction: ${soapAction}`);
  }
  lines.push(`    ${serviceName}-->>-Client: ${operationName}Response`);
  lines.push("```");
  return lines.join("\n") + "\n";
}

/**
 * Generate Markdown documentation from a parsed WSDL.
 */
export function generateWsdlDocumentation(wsdl: WsdlParseResult): string {
  const serviceName = wsdl.services[0]?.name ?? "Unknown Service";
  const endpoint = wsdl.services[0]?.ports[0]?.address ?? "N/A";
  const namespace = wsdl.metadata.targetNamespace;
  const typeMap = new Map(wsdl.types.map((t) => [t.name, t]));

  const sections: string[] = [];

  // Header
  sections.push(`# ${serviceName}\n`);
  sections.push(`| Property | Value |`);
  sections.push(`|----------|-------|`);
  sections.push(`| **Namespace** | \`${namespace}\` |`);
  sections.push(`| **Endpoint** | \`${endpoint}\` |`);
  sections.push(`| **Operations** | ${wsdl.operations.length} |`);
  sections.push(`| **Source** | ${wsdl.metadata.fileName} |`);
  sections.push("");

  if (wsdl.operations.length === 0) {
    sections.push("No operations defined in this WSDL.\n");

    logger.info("WSDL documentation generated", { serviceName, operations: "0" });
    return sections.join("\n");
  }

  // Operations summary table
  sections.push("## Operations\n");
  sections.push("| Operation | Input | Output | SOAP Action |");
  sections.push("|-----------|-------|--------|-------------|");
  for (const op of wsdl.operations) {
    sections.push(`| ${op.name} | ${op.inputMessage} | ${op.outputMessage} | ${op.soapAction ?? "—"} |`);
  }
  sections.push("");

  // Detailed operation sections
  for (const op of wsdl.operations) {
    sections.push(`## ${op.name}\n`);

    // Input fields
    const inputType = typeMap.get(op.inputMessage);
    sections.push("### Request Fields\n");
    sections.push(renderFieldsTable(inputType?.fields ?? []));

    // Output fields
    const outputType = typeMap.get(op.outputMessage);
    sections.push("### Response Fields\n");
    sections.push(renderFieldsTable(outputType?.fields ?? []));

    // Sequence diagram
    sections.push("### Sequence Diagram\n");
    sections.push(renderSequenceDiagram(op.name, serviceName, op.soapAction));
  }

  logger.info("WSDL documentation generated", {
    serviceName,
    operations: String(wsdl.operations.length),
  });

  return sections.join("\n");
}
