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
import { SiebelObjectTypeSchema } from "../../schemas/siebel.schema.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";

export function registerSiebelGenerateSif(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel_generate_sif",
    "Generate Siebel SIF files using RAG context. Two-phase: action=prepare returns context+prompt for the LLM; action=finalize validates the LLM-generated XML and indexes it.",
    {
      action: z.enum(["prepare", "finalize", "templates"]).describe(
        "Phase: prepare (get context+prompt), finalize (validate XML), templates (list available templates)",
      ),
      // prepare params
      description: z.string().optional().describe("What to generate (for prepare)"),
      objectTypes: z.array(SiebelObjectTypeSchema).optional().describe("Siebel object types to generate"),
      basedOnProject: z.string().optional().describe("Base project name for context"),
      properties: z.record(z.string(), z.string()).optional().describe("Default properties for generated objects"),
      // finalize params
      generatedXml: z.string().optional().describe("LLM-generated SIF XML content (for finalize)"),
    },
    async ({ action, description, objectTypes, basedOnProject, properties, generatedXml }) => {
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
