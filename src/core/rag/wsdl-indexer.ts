/**
 * WSDL Indexer — indexes parsed WSDL content into the knowledge store
 * for RAG retrieval during integration development workflows.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";
import type { WsdlParseResult, WsdlOperation, WsdlComplexType } from "../siebel/wsdl-parser.js";

export interface WsdlIndexResult {
  documentsIndexed: number;
  sourceFile: string;
}

/**
 * Index parsed WSDL content into the knowledge store.
 * Each operation + each complex type becomes a knowledge document.
 */
export function indexWsdlContent(
  knowledgeStore: KnowledgeStore,
  parseResult: WsdlParseResult,
): WsdlIndexResult {
  const { metadata, operations, types, services, messages } = parseResult;
  const sourceId = `siebel_wsdl:${metadata.fileName}`;

  // Clean previous version
  knowledgeStore.deleteBySource("siebel_wsdl", sourceId);

  const endpointUrl = services[0]?.ports[0]?.address ?? "";
  const namespace = metadata.targetNamespace;

  // Build message-to-type mapping for enrichment
  const messageTypeMap = new Map<string, string>();
  for (const msg of messages) {
    for (const part of msg.parts) {
      const typeName = part.type.includes(":") ? part.type.split(":")[1] : part.type;
      messageTypeMap.set(msg.name, typeName);
    }
  }

  const chunks: { sourceType: "siebel_wsdl"; sourceId: string; title: string; content: string; chunkIndex: number; metadata: Record<string, unknown> }[] = [];
  let idx = 0;

  // Index operations
  for (const op of operations) {
    const inputTypeName = messageTypeMap.get(op.inputMessage) ?? op.inputMessage;
    const outputTypeName = messageTypeMap.get(op.outputMessage) ?? op.outputMessage;
    const inputType = types.find((t) => t.name === inputTypeName);
    const outputType = types.find((t) => t.name === outputTypeName);

    const content = buildOperationContent(op, inputType, outputType, endpointUrl, namespace);

    chunks.push({
      sourceType: "siebel_wsdl",
      sourceId,
      title: `WSDL Operation: ${op.name}`,
      content,
      chunkIndex: idx++,
      metadata: {
        operationName: op.name,
        serviceName: services[0]?.name ?? "",
        namespace,
        endpointUrl,
        soapAction: op.soapAction,
        fileName: metadata.fileName,
        indexedAt: new Date().toISOString(),
      },
    });
  }

  // Index complex types
  for (const type of types) {
    const content = buildTypeContent(type, namespace);

    chunks.push({
      sourceType: "siebel_wsdl",
      sourceId,
      title: `WSDL Type: ${type.name}`,
      content,
      chunkIndex: idx++,
      metadata: {
        typeName: type.name,
        fieldCount: type.fields.length,
        namespace,
        fileName: metadata.fileName,
        indexedAt: new Date().toISOString(),
      },
    });
  }

  const docs = knowledgeStore.insertChunks(chunks);

  logger.info("WSDL content indexed", {
    sourceFile: metadata.fileName,
    operations: String(operations.length),
    types: String(types.length),
    documents: String(docs.length),
  });

  return { documentsIndexed: docs.length, sourceFile: metadata.fileName };
}

function buildOperationContent(
  op: WsdlOperation,
  inputType: WsdlComplexType | undefined,
  outputType: WsdlComplexType | undefined,
  endpointUrl: string,
  namespace: string,
): string {
  const parts: string[] = [];

  parts.push(`# WSDL Operation: ${op.name}`);
  parts.push(`Namespace: ${namespace}`);
  parts.push(`Endpoint: ${endpointUrl}`);
  if (op.soapAction) parts.push(`SOAP Action: ${op.soapAction}`);
  parts.push(`Input Message: ${op.inputMessage}`);
  parts.push(`Output Message: ${op.outputMessage}`);

  if (inputType) {
    parts.push(`\n## Input Fields (${inputType.name})`);
    for (const f of inputType.fields) {
      const flags = [f.optional ? "optional" : "required", f.isArray ? "array" : ""].filter(Boolean).join(", ");
      parts.push(`- ${f.name}: ${f.type} (${flags})`);
    }
  }

  if (outputType) {
    parts.push(`\n## Output Fields (${outputType.name})`);
    for (const f of outputType.fields) {
      const flags = [f.optional ? "optional" : "required", f.isArray ? "array" : ""].filter(Boolean).join(", ");
      parts.push(`- ${f.name}: ${f.type} (${flags})`);
    }
  }

  return parts.join("\n");
}

function buildTypeContent(type: WsdlComplexType, namespace: string): string {
  const parts: string[] = [];

  parts.push(`# WSDL Type: ${type.name}`);
  parts.push(`Namespace: ${namespace}`);
  parts.push(`Fields: ${type.fields.length}`);
  parts.push("");

  for (const f of type.fields) {
    const flags = [f.optional ? "optional" : "required", f.isArray ? "array" : ""].filter(Boolean).join(", ");
    parts.push(`- ${f.name}: ${f.type} (${flags})`);
  }

  return parts.join("\n");
}
