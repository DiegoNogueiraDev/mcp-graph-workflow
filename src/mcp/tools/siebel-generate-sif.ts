/**
 * MCP Tool: siebel_generate_sif
 * Two-phase SIF generation: prepare context + finalize generated XML.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { prepareSifGeneration, finalizeSifGeneration } from "../../core/siebel/sif-generator.js";
import { listTemplates } from "../../core/siebel/sif-templates.js";
import { scaffoldSiebelObjects } from "../../core/siebel/scaffold-generator.js";
import { cloneAndAdapt } from "../../core/siebel/clone-adapt.js";
import { generateEScript } from "../../core/siebel/escript-generator.js";
import { formatDiffMarkdown } from "../../core/siebel/sif-diff.js";
import { autoWireDependencies } from "../../core/siebel/auto-wiring.js";
import { generateSifFromWsdl } from "../../core/siebel/wsdl-to-sif.js";
import { parseWsdlContent } from "../../core/siebel/wsdl-parser.js";
import { SiebelObjectTypeSchema } from "../../schemas/siebel.schema.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";
import { parseSifContent } from "../../core/siebel/sif-parser.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";

export function registerSiebelGenerateSif(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel_generate_sif",
    "Generate Siebel SIF files. Actions: prepare (RAG context+prompt), finalize (validate XML), templates (list), scaffold (auto-generate objects from description).",
    {
      action: z.enum(["prepare", "finalize", "templates", "scaffold", "clone_adapt", "generate_script", "auto_wire", "wsdl_to_sif"]).describe(
        "Actions: prepare, finalize, templates, scaffold, clone_adapt, generate_script, auto_wire, wsdl_to_sif",
      ),
      wsdlContent: z.string().optional().describe("WSDL XML content (for wsdl_to_sif action)"),
      existingBcName: z.string().optional().describe("Existing BC name to skip BC generation (wsdl_to_sif)"),
      // prepare params
      description: z.string().optional().describe("What to generate (for prepare)"),
      objectTypes: z.array(SiebelObjectTypeSchema).optional().describe("Siebel object types to generate"),
      basedOnProject: z.string().optional().describe("Base project name for context"),
      properties: z.record(z.string(), z.string()).optional().describe("Default properties for generated objects"),
      // finalize params
      generatedXml: z.string().optional().describe("LLM-generated SIF XML content (for finalize)"),
      // scaffold params
      prefix: z.string().optional().describe("Naming prefix for scaffold (e.g., 'CX_')"),
      includeScriptBoilerplate: z.boolean().optional().default(false).describe("Include eScript boilerplate (scaffold)"),
      // clone_adapt params
      sourceSifContent: z.string().optional().describe("SIF XML of the source object to clone (clone_adapt)"),
      sourceObjectName: z.string().optional().describe("Name of the object to clone from the SIF (clone_adapt)"),
      newName: z.string().optional().describe("New name for the cloned object (clone_adapt)"),
      renames: z.record(z.string(), z.string()).optional().describe("Map of old→new names for reference replacement (clone_adapt)"),
      addFields: z.array(z.string()).optional().describe("Field names to add to the clone (clone_adapt)"),
      removeFields: z.array(z.string()).optional().describe("Field names to remove from the clone (clone_adapt)"),
      // generate_script params
      parentObjectName: z.string().optional().describe("Parent object name, e.g. 'CX Order Applet' (generate_script)"),
      parentObjectType: z.enum(["applet", "business_component", "business_service"]).optional().describe("Parent object type (generate_script)"),
      eventName: z.string().optional().describe("Event handler name, e.g. 'PreInvokeMethod' (generate_script)"),
    },
    async ({ action, description, objectTypes, basedOnProject, properties, generatedXml, prefix, includeScriptBoilerplate, sourceSifContent, sourceObjectName, newName, renames, addFields, removeFields, parentObjectName, parentObjectType, eventName, wsdlContent, existingBcName }) => {
      logger.info("tool:siebel_generate_sif", { action });

      try {
        if (action === "templates") {
          const templates = listTemplates();
          return mcpText({
            ok: true,
            templates: templates.map((t) => ({
              type: t.type,
              xmlTag: t.xmlTag,
              requiredAttrs: t.requiredAttrs,
              optionalAttrs: t.optionalAttrs,
              childTags: t.childTags,
            })),
          });
        }

        const knowledgeStore = new KnowledgeStore(store.getDb());

        if (action === "prepare") {
          if (!description) {
            return mcpError("description is required for prepare action");
          }
          if (!objectTypes || objectTypes.length === 0) {
            return mcpError("objectTypes is required for prepare action");
          }

          const context = prepareSifGeneration(knowledgeStore, {
            description,
            objectTypes,
            basedOnProject,
            properties,
          });

          return mcpText({
            ok: true,
            action: "prepare",
            prompt: context.prompt,
            templates: context.templates.map((t) => t.type),
            existingObjectsCount: context.existingObjects.length,
            relatedDocsCount: context.relatedDocs.length,
            validationRules: context.validationRules,
          });
        }

        if (action === "finalize") {
          if (!generatedXml) {
            return mcpError("generatedXml is required for finalize action");
          }

          const normalized = normalizeNewlines(generatedXml) ?? generatedXml;

          const result = finalizeSifGeneration(
            knowledgeStore,
            normalized,
            {
              description: description ?? "SIF generation",
              objectTypes: objectTypes ?? [],
            },
          );

          return mcpText({
            ok: true,
            action: "finalize",
            sifContent: result.sifContent,
            objectCount: result.metadata.objectCount,
            objects: result.objects,
            validation: result.validation,
            metadata: result.metadata,
          });
        }

        if (action === "scaffold") {
          if (!description) {
            return mcpError("description is required for scaffold action");
          }

          // Load reference objects from knowledge store for template learning
          const referenceObjects = loadReferenceObjects(knowledgeStore);

          const scaffoldResult = scaffoldSiebelObjects({
            description,
            prefix: prefix ?? "CX_",
            projectName: basedOnProject ?? "Generated Project",
            referenceObjects,
            includeScriptBoilerplate,
          });

          return mcpText({
            ok: true,
            action: "scaffold",
            sifContent: scaffoldResult.sifXml,
            objectCount: scaffoldResult.objects.length,
            objects: scaffoldResult.objects.map((o) => ({ name: o.name, type: o.type })),
            validationScore: scaffoldResult.validationScore,
            scriptBoilerplate: scaffoldResult.scriptBoilerplate,
          });
        }

        if (action === "clone_adapt") {
          if (!sourceSifContent || !sourceObjectName || !newName) {
            return mcpError("sourceSifContent, sourceObjectName, and newName are required for clone_adapt action");
          }

          const normalized = normalizeNewlines(sourceSifContent) ?? sourceSifContent;
          const parseResult = parseSifContent(normalized, "clone-source.sif");
          const sourceObj = parseResult.objects.find((o) => o.name === sourceObjectName);

          if (!sourceObj) {
            return mcpError(`Object "${sourceObjectName}" not found in SIF content. Available: ${parseResult.objects.map((o) => o.name).join(", ")}`);
          }

          // Build add/remove children
          const addChildren = addFields?.map((name) => ({
            name,
            type: "control" as const,
            properties: [{ name: "FIELD", value: name }],
            children: [] as SiebelObject[],
          }));
          const removeChildren = removeFields;

          const result = cloneAndAdapt({
            source: sourceObj,
            newName,
            renames: renames ?? {},
            addChildren,
            removeChildren,
          });

          const diffMarkdown = formatDiffMarkdown(result.diff);

          return mcpText({
            ok: true,
            action: "clone_adapt",
            clonedObject: { name: result.cloned.name, type: result.cloned.type },
            childCount: result.cloned.children.length,
            renamesApplied: result.renamesApplied,
            diff: result.diff.summary,
            diffMarkdown,
          });
        }

        if (action === "generate_script") {
          if (!parentObjectName || !parentObjectType || !eventName || !description) {
            return mcpError("parentObjectName, parentObjectType, eventName, and description are required for generate_script action");
          }

          const scriptResult = generateEScript({
            parentObjectName,
            parentObjectType,
            eventName,
            behaviorDescription: description,
            referenceScripts: [],
          });

          return mcpText({
            ok: true,
            action: "generate_script",
            functionName: scriptResult.functionName,
            eventName: scriptResult.eventName,
            script: scriptResult.script,
            sifXmlBlock: scriptResult.sifXmlBlock,
            referencedEntities: scriptResult.referencedEntities,
          });
        }

        if (action === "wsdl_to_sif") {
          if (!wsdlContent) {
            return mcpError("wsdlContent is required for wsdl_to_sif action");
          }
          const normalized = normalizeNewlines(wsdlContent) ?? wsdlContent;
          const wsdlResult = parseWsdlContent(normalized, "wsdl-input.wsdl");
          const sifResult = generateSifFromWsdl(wsdlResult, {
            prefix: prefix ?? "CX",
            projectName: basedOnProject,
            existingBcName,
          });

          return mcpText({
            ok: true,
            action: "wsdl_to_sif",
            objectCount: sifResult.objects.length,
            operationCount: sifResult.operationCount,
            objects: sifResult.objects.map((o) => ({ name: o.name, type: o.type, fields: o.children.length })),
            validationScore: sifResult.validationScore,
            sifContent: sifResult.sifXml,
          });
        }

        if (action === "auto_wire") {
          if (!sourceSifContent) {
            return mcpError("sourceSifContent is required for auto_wire action (SIF XML with new objects)");
          }

          const normalized = normalizeNewlines(sourceSifContent) ?? sourceSifContent;
          const parseResult = parseSifContent(normalized, "auto-wire-source.sif");

          // Load repository objects from knowledge store
          const ks = new KnowledgeStore(store.getDb());
          const repositoryObjects = loadReferenceObjects(ks);

          const wireResult = autoWireDependencies({
            newObjects: parseResult.objects,
            repository: repositoryObjects,
          });

          return mcpText({
            ok: true,
            action: "auto_wire",
            wiredEdges: wireResult.wiredEdges.length,
            missingDependencies: wireResult.missingDependencies.length,
            edges: wireResult.wiredEdges.map((e) => ({
              from: `${e.from.type}:${e.from.name}`,
              to: `${e.to.type}:${e.to.name}`,
              relation: e.relationType,
            })),
            missing: wireResult.missingDependencies.map((d) => ({
              from: `${d.from.type}:${d.from.name}`,
              to: `${d.to.type}:${d.to.name}`,
              suggestion: d.suggestion,
            })),
            report: wireResult.report,
          });
        }

        return mcpError(`Unknown action: ${action}`);
      } catch (err) {
        logger.error("tool:siebel_generate_sif failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}

/**
 * Load reference Siebel objects from knowledge store for template learning.
 * Returns parsed SiebelObjects from indexed SIF content.
 */
function loadReferenceObjects(knowledgeStore: KnowledgeStore): SiebelObject[] {
  try {
    const docs = knowledgeStore.search("siebel object", 50);
    const sifDocs = docs.filter((d) => d.sourceType === "siebel_sif" || d.sourceType === "siebel_sif_raw");

    const objects: SiebelObject[] = [];
    for (const doc of sifDocs) {
      try {
        const parseResult = parseSifContent(doc.content, doc.title);
        objects.push(...parseResult.objects);
      } catch {
        // Individual doc parse failure — skip silently
      }
    }

    logger.debug("scaffold:loadReferenceObjects", {
      docsFound: String(sifDocs.length),
      objectsLoaded: String(objects.length),
    });

    return objects;
  } catch {
    // Empty knowledge store or search failure
    return [];
  }
}
