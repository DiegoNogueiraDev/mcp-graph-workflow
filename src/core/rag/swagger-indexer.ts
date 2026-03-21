/**
 * Swagger Indexer — indexes parsed Swagger/WSDL content into the knowledge store
 * for RAG retrieval during Siebel Integration Object generation.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";
import type { SwaggerParseResult, SwaggerEndpoint, SwaggerSchema } from "../parser/read-swagger.js";

export interface SwaggerIndexResult {
  documentsIndexed: number;
  fileName: string;
}

/**
 * Index parsed Swagger/WSDL content into the knowledge store.
 * Each endpoint and schema becomes a knowledge document.
 */
export function indexSwaggerContent(
  knowledgeStore: KnowledgeStore,
  parseResult: SwaggerParseResult,
  fileName: string,
): SwaggerIndexResult {
  const { endpoints, schemas, title, version, format } = parseResult;

  if (endpoints.length === 0 && schemas.length === 0) {
    logger.info("No Swagger content to index", { fileName });
    return { documentsIndexed: 0, fileName };
  }

  const sourceId = `swagger:${fileName}`;

  // Remove previous version to re-index fresh content
  knowledgeStore.deleteBySource("swagger", sourceId);

  const chunks: Array<{
    sourceType: "swagger";
    sourceId: string;
    title: string;
    content: string;
    chunkIndex: number;
    metadata: Record<string, unknown>;
  }> = [];

  let chunkIndex = 0;

  // Index each endpoint
  for (const endpoint of endpoints) {
    chunks.push({
      sourceType: "swagger",
      sourceId,
      title: `${endpoint.method} ${endpoint.path}`,
      content: buildEndpointContent(endpoint, title),
      chunkIndex: chunkIndex++,
      metadata: {
        apiTitle: title,
        apiVersion: version,
        apiFormat: format,
        method: endpoint.method,
        path: endpoint.path,
        operationId: endpoint.operationId,
        fileName,
        indexedAt: new Date().toISOString(),
      },
    });
  }

  // Index each schema
  for (const schema of schemas) {
    chunks.push({
      sourceType: "swagger",
      sourceId,
      title: `Schema: ${schema.name}`,
      content: buildSchemaContent(schema, title),
      chunkIndex: chunkIndex++,
      metadata: {
        apiTitle: title,
        apiVersion: version,
        apiFormat: format,
        schemaName: schema.name,
        fileName,
        indexedAt: new Date().toISOString(),
      },
    });
  }

  const docs = knowledgeStore.insertChunks(chunks);

  logger.info("Swagger content indexed", {
    fileName,
    endpoints: String(endpoints.length),
    schemas: String(schemas.length),
    documents: String(docs.length),
  });

  return { documentsIndexed: docs.length, fileName };
}

/**
 * Build searchable text content from a Swagger endpoint.
 */
function buildEndpointContent(endpoint: SwaggerEndpoint, apiTitle: string): string {
  const parts: string[] = [];

  parts.push(`# API Endpoint: ${endpoint.method} ${endpoint.path}`);
  parts.push(`API: ${apiTitle}`);

  if (endpoint.summary) {
    parts.push(`Summary: ${endpoint.summary}`);
  }

  if (endpoint.operationId) {
    parts.push(`Operation ID: ${endpoint.operationId}`);
  }

  if (endpoint.parameters.length > 0) {
    parts.push("## Parameters");
    for (const param of endpoint.parameters) {
      const req = param.required ? " (required)" : "";
      parts.push(`- ${param.name}: ${param.type} [${param.location}]${req}`);
    }
  }

  if (endpoint.requestBody) {
    parts.push(`## Request Body: ${endpoint.requestBody}`);
  }

  if (endpoint.responses.length > 0) {
    parts.push("## Responses");
    for (const resp of endpoint.responses) {
      parts.push(`- ${resp}`);
    }
  }

  return parts.join("\n");
}

/**
 * Build searchable text content from a Swagger schema.
 */
function buildSchemaContent(schema: SwaggerSchema, apiTitle: string): string {
  const parts: string[] = [];

  parts.push(`# Schema: ${schema.name}`);
  parts.push(`API: ${apiTitle}`);
  parts.push(`Type: ${schema.type}`);

  if (schema.properties.length > 0) {
    parts.push("## Properties");
    for (const prop of schema.properties) {
      const req = prop.required ? " (required)" : "";
      parts.push(`- ${prop.name}: ${prop.type}${req}`);
    }
  }

  if (schema.required.length > 0) {
    parts.push(`## Required Fields: ${schema.required.join(", ")}`);
  }

  return parts.join("\n");
}
