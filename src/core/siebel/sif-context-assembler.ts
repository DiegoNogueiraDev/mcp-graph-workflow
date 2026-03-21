/**
 * SIF Context Assembler — builds RAG-optimized context for SIF generation.
 *
 * Queries the knowledge store for existing Siebel objects, documentation,
 * and Swagger specs to assemble a rich context payload for the LLM.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";
import { getTemplate, type SifTemplate } from "./sif-templates.js";
import type { SifGenerationRequest, SifTemplateType } from "../../schemas/siebel.schema.js";
import type { KnowledgeDocument } from "../../schemas/knowledge.schema.js";

/** Summary of a knowledge document for context assembly. */
export interface KnowledgeSummary {
  title: string;
  content: string;
  sourceType: string;
  score?: number;
}

/** Assembled context for SIF generation. */
export interface SifGenerationContext {
  existingObjects: KnowledgeSummary[];
  templates: SifTemplate[];
  exampleSif: string;
  relatedDocs: KnowledgeSummary[];
  validationRules: string[];
  prompt: string;
}

/** Validation rules that apply to all generated SIF. */
const BASE_VALIDATION_RULES: string[] = [
  "Every object must have a NAME attribute",
  "XML must follow REPOSITORY > PROJECT > Objects hierarchy",
  "Use valid Siebel object tags: APPLET, BUSINESS_COMPONENT, BUSINESS_OBJECT, VIEW, SCREEN, WORKFLOW, BUSINESS_SERVICE, INTEGRATION_OBJECT",
  "Business Components must have a TABLE attribute referencing a valid Siebel table",
  "Applets must have a BUS_COMP attribute referencing a Business Component",
  "Views must have a BUS_OBJECT attribute referencing a Business Object",
  "Field names must be unique within a Business Component",
  "Control names must be unique within an Applet",
];

/**
 * Assemble a SIF generation context from the knowledge store.
 *
 * Pipeline:
 * 1. Search existing Siebel objects by type/project
 * 2. Select relevant templates
 * 3. Search for example SIF content
 * 4. Search related documentation and swagger specs
 * 5. Build structured prompt
 */
export function assembleSifContext(
  knowledgeStore: KnowledgeStore,
  request: SifGenerationRequest,
): SifGenerationContext {
  logger.info("Assembling SIF generation context", {
    types: request.objectTypes.join(","),
    project: request.basedOnProject ?? "none",
  });

  // 1. Search existing Siebel objects
  const existingObjects = searchExistingObjects(knowledgeStore, request);

  // 2. Select templates for requested types (only for generatable types)
  const templates = request.objectTypes
    .map((type) => getTemplate(type as SifTemplateType))
    .filter((t): t is SifTemplate => t !== undefined);

  // 3. Search for example SIF content
  const exampleSif = searchExampleSif(knowledgeStore, request);

  // 4. Search related docs (documentation, swagger)
  const relatedDocs = searchRelatedDocs(knowledgeStore, request);

  // 5. Build validation rules
  const validationRules = buildValidationRules(request);

  // 6. Build structured prompt
  const prompt = buildPrompt(request, templates, existingObjects, relatedDocs, exampleSif, validationRules);

  logger.debug("SIF context assembled", {
    existingObjects: String(existingObjects.length),
    templates: String(templates.length),
    relatedDocs: String(relatedDocs.length),
    promptLength: String(prompt.length),
  });

  return {
    existingObjects,
    templates,
    exampleSif,
    relatedDocs,
    validationRules,
    prompt,
  };
}

function searchExistingObjects(
  knowledgeStore: KnowledgeStore,
  request: SifGenerationRequest,
): KnowledgeSummary[] {
  const summaries: KnowledgeSummary[] = [];

  // Search by each object type separately for better FTS5 matching
  for (const type of request.objectTypes) {
    try {
      const results = knowledgeStore.search(type.replace(/_/g, " "), 5);
      for (const r of results) {
        if (r.sourceType === "siebel_sif" || r.sourceType === "siebel_generated") {
          summaries.push(docToSummary(r));
        }
      }
    } catch {
      // FTS5 may throw on empty index — safe to ignore
    }
  }

  // Also search by key words from description
  const descWords = request.description
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);
  for (const word of descWords) {
    try {
      const results = knowledgeStore.search(word, 5);
      for (const r of results) {
        if (r.sourceType === "siebel_sif" || r.sourceType === "siebel_generated") {
          if (!summaries.some((s) => s.title === r.title)) {
            summaries.push(docToSummary(r));
          }
        }
      }
    } catch {
      // Ignore FTS5 errors
    }
  }

  logger.debug("Existing objects search", { found: String(summaries.length) });
  return summaries;
}

function searchExampleSif(
  knowledgeStore: KnowledgeStore,
  request: SifGenerationRequest,
): string {
  try {
    const type = request.objectTypes[0].replace(/_/g, " ");
    const results = knowledgeStore.search(type, 3);
    const sifDoc = results.find((r) => r.sourceType === "siebel_sif");
    return sifDoc?.content ?? "";
  } catch {
    return "";
  }
}

function searchRelatedDocs(
  knowledgeStore: KnowledgeStore,
  request: SifGenerationRequest,
): KnowledgeSummary[] {
  const docTypes = new Set(["siebel_docs", "swagger", "docs", "prd"]);
  const summaries: KnowledgeSummary[] = [];

  // Search by key words from description
  const words = request.description
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  for (const word of words) {
    try {
      const results = knowledgeStore.search(word, 5);
      for (const r of results) {
        if (docTypes.has(r.sourceType) && !summaries.some((s) => s.title === r.title)) {
          summaries.push(docToSummary(r));
        }
      }
    } catch {
      // Ignore FTS5 errors
    }
  }

  // Also search by object types
  for (const type of request.objectTypes) {
    try {
      const results = knowledgeStore.search(type.replace(/_/g, " "), 5);
      for (const r of results) {
        if (docTypes.has(r.sourceType) && !summaries.some((s) => s.title === r.title)) {
          summaries.push(docToSummary(r));
        }
      }
    } catch {
      // Ignore
    }
  }

  return summaries;
}

function docToSummary(doc: KnowledgeDocument): KnowledgeSummary {
  return {
    title: doc.title,
    content: doc.content,
    sourceType: doc.sourceType,
  };
}

function buildValidationRules(request: SifGenerationRequest): string[] {
  const rules = [...BASE_VALIDATION_RULES];

  // Add type-specific rules
  for (const type of request.objectTypes) {
    const template = getTemplate(type as SifTemplateType);
    if (template) {
      for (const attr of template.requiredAttrs) {
        if (attr !== "NAME") {
          rules.push(`${template.xmlTag} must have a ${attr} attribute`);
        }
      }
    }
  }

  return rules;
}

function buildPrompt(
  request: SifGenerationRequest,
  templates: SifTemplate[],
  existingObjects: KnowledgeSummary[],
  relatedDocs: KnowledgeSummary[],
  exampleSif: string,
  validationRules: string[],
): string {
  const parts: string[] = [];

  // Header
  parts.push("# SIF Generation Request");
  parts.push("");
  parts.push(`**Description:** ${request.description}`);
  parts.push(`**Object types:** ${request.objectTypes.join(", ")}`);
  if (request.basedOnProject) {
    parts.push(`**Project:** ${request.basedOnProject}`);
  }
  if (request.properties) {
    parts.push(`**Properties:** ${JSON.stringify(request.properties)}`);
  }

  // Templates
  parts.push("");
  parts.push("## Available Templates");
  parts.push("");
  for (const template of templates) {
    parts.push(`### ${template.xmlTag}`);
    parts.push(`- Required attributes: ${template.requiredAttrs.join(", ")}`);
    parts.push(`- Optional attributes: ${template.optionalAttrs.join(", ")}`);
    parts.push(`- Child elements: ${template.childTags.join(", ") || "none"}`);
    parts.push("");
  }

  // Expected XML structure
  parts.push("## Expected SIF XML Structure");
  parts.push("");
  parts.push("```xml");
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<REPOSITORY NAME="Siebel Repository">');
  parts.push(`  <PROJECT NAME="${request.basedOnProject ?? "Generated Project"}">`);
  for (const template of templates) {
    parts.push(`    <${template.xmlTag} NAME="..." ${template.requiredAttrs.filter((a) => a !== "NAME").map((a) => `${a}="..."`).join(" ")}>`);
    if (template.childTags.length > 0) {
      parts.push(`      <${template.childTags[0]} NAME="..." />`);
    }
    parts.push(`    </${template.xmlTag}>`);
  }
  parts.push("  </PROJECT>");
  parts.push("</REPOSITORY>");
  parts.push("```");

  // Existing objects context
  if (existingObjects.length > 0) {
    parts.push("");
    parts.push("## Existing Siebel Objects (for reference)");
    parts.push("");
    for (const obj of existingObjects.slice(0, 5)) {
      parts.push(`### ${obj.title}`);
      parts.push(obj.content.slice(0, 500));
      parts.push("");
    }
  }

  // Related documentation
  if (relatedDocs.length > 0) {
    parts.push("");
    parts.push("## Related Documentation");
    parts.push("");
    for (const doc of relatedDocs.slice(0, 5)) {
      parts.push(`### ${doc.title} (${doc.sourceType})`);
      parts.push(doc.content.slice(0, 500));
      parts.push("");
    }
  }

  // Example SIF
  if (exampleSif) {
    parts.push("");
    parts.push("## Example SIF Content");
    parts.push("");
    parts.push(exampleSif.slice(0, 1000));
  }

  // Validation rules
  parts.push("");
  parts.push("## Validation Rules");
  parts.push("");
  for (const rule of validationRules) {
    parts.push(`- ${rule}`);
  }

  // Instructions
  parts.push("");
  parts.push("## Instructions");
  parts.push("");
  parts.push("Generate a valid Siebel SIF XML file following the structure above.");
  parts.push("Return ONLY the XML content, no markdown code blocks or explanations.");
  parts.push("Ensure all required attributes are present for each object type.");

  return parts.join("\n");
}
